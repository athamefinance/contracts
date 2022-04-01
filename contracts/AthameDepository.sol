// contracts/AthameDepository.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IERC20Mintable.sol";
import "./interfaces/ITreasury.sol";

contract AthameDepository is Ownable, Pausable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    /* ======== EVENTS ======== */

    event OnInvestment(
        uint256 shares,
        uint256 investmentValue,
        address investor
    );
    event Withdrawal(address indexed token, uint256 amount);
    event Deposit(uint256 amount);
    event Claim(address indexed investor, uint256 amount);

    /* ======== STRUCTS ======== */
    struct Investor {
        address account;
        uint256 totalShareCount; // sum of all shares
        uint256 unclaimedDividends; // dividends waiting to be claimed
        Investment[] investments;
    }

    struct Investment {
        uint256 created;
        // after the vesting period this will be added to the totalShareCount
        // which is used to distribute dividends
        uint256 shareCount; // shares purchased
        bool vested;
    }

    /* ======== STATE VARIABLES ======== */
    uint256 public fee; // as % of deposit in hundreths. (100 = 10% = 0.1)
    address public feeCollector;
    uint256 public totalClaimed; // total claimed
    uint256 public totalUnclaimed; // waiting to be claimed
    uint256 public totalShareCount; // sum of investor shares
    address public treasury; // contract address that receives deposits
    address public depositToken; // token allowed for deposits
    /* solhint-disable var-name-mixedcase */
    address public ATHAME; // token used for voting privileges
    uint256 public sharePrice; // the price per share
    mapping(address => Investor) public investors; // keeps track of investors and shares per account
    address[] public accounts; // list of all accounts or keys within investors
    uint256 public accountCount;
    uint256 public constant VESTING_PERIOD = 7 days;

    /* ======== INITIALIZATION ======== */

    constructor(
        address _treasury,
        address _athame,
        address _depositToken,
        address _feeCollector,
        uint256 _sharePrice
    ) {
        _pause(); // initialize paused

        feeCollector = _feeCollector;
        treasury = _treasury;
        ATHAME = _athame;
        depositToken = _depositToken;
        sharePrice = _sharePrice;

        // defaults
        fee = 100;
    }

    /* ======== POLICY FUNCTIONS ======== */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setDepositToken(address _token) external onlyOwner {
        depositToken = _token;
    }

    function setSharePrice(uint256 _value) external onlyOwner {
        sharePrice = _value;
    }

    /* ======== MAIN FUNCTIONS ======== */
    function deposit(uint256 _amount) external onlyOwner {
        // fee
        uint256 totalFee = _amount.mul(fee).div(1000);
        uint256 finalAmount = _amount.sub(totalFee);

        // transfer funds in
        IERC20(depositToken).safeTransferFrom(
            msg.sender,
            address(this),
            finalAmount
        );

        // Transfer the fee
        if (fee != 0) {
            IERC20(depositToken).safeTransferFrom(
                msg.sender,
                feeCollector,
                totalFee
            );
        }

        // update the investors total shares
        updateInvestors();

        uint256 vestedShares = 0;

        // get total vested shares
        for (uint32 i = 0; i < accounts.length; i++) {
            address currentHolder = accounts[i];
            Investor memory investor = investors[currentHolder];
            vestedShares = vestedShares.add(investor.totalShareCount);
        }

        if (vestedShares > 0) {
            // Reward per share
            uint256 rewardPerShare = finalAmount / vestedShares;

            for (uint32 i = 0; i < accounts.length; i++) {
                // Calculate the reward
                address currentHolder = accounts[i];
                Investor storage investor = investors[currentHolder];
                uint256 rewardToBeDistributed = rewardPerShare *
                    investor.totalShareCount;

                investor.unclaimedDividends = investor.unclaimedDividends.add(
                    rewardToBeDistributed
                );
            }
        }

        totalUnclaimed = totalUnclaimed.add(finalAmount);

        emit Deposit(finalAmount);
    }

    function withdraw(uint256 _amount) external onlyOwner {
        IERC20(depositToken).safeTransfer(msg.sender, _amount);

        totalUnclaimed = totalUnclaimed.sub(_amount);

        emit Withdrawal(depositToken, _amount);
    }

    /* ======== USER FUNCTIONS ======== */

    function buyShares(uint256 _shareCount) external whenNotPaused {
        uint256 _totalPrice = sharePrice;
        uint256 _totalAmount = _totalPrice * _shareCount;

        /**
            token is transferred in and
            deposited into the treasury
         */
        IERC20(depositToken).safeTransferFrom(
            msg.sender,
            address(this),
            _totalAmount
        );
        IERC20(depositToken).approve(address(treasury), _totalAmount);
        ITreasury(treasury).deposit(_totalAmount, depositToken);

        // update contract total shares
        totalShareCount = totalShareCount.add(_shareCount);

        // if null then add
        if (investors[msg.sender].account == address(0)) {
            investors[msg.sender].account = msg.sender; // add investor
            accounts.push(msg.sender); // add account
            accountCount += 1;
        }

        // send investor 1 governance token per share
        IERC20Mintable(ATHAME).mint(
            msg.sender,
            _shareCount * 10**ERC20(ATHAME).decimals()
        );

        // update investor share count
        investors[msg.sender].investments.push(
            Investment({
                created: block.timestamp,
                shareCount: _shareCount,
                vested: false
            })
        );

        emit OnInvestment(_shareCount, sharePrice.mul(_shareCount), msg.sender);
    }

    function claim() external {
        Investor storage investor = investors[msg.sender];
        uint256 contractBalance = IERC20(depositToken).balanceOf(address(this));

        require(investor.unclaimedDividends > 0, "nothing to claim");
        require(
            contractBalance >= investor.unclaimedDividends,
            "not enough liquidity"
        );

        IERC20(depositToken).safeTransfer(
            msg.sender,
            investor.unclaimedDividends
        );
        totalUnclaimed = totalUnclaimed.sub(investor.unclaimedDividends);
        totalClaimed = totalClaimed.add(investor.unclaimedDividends);

        emit Claim(msg.sender, investor.unclaimedDividends);

        investor.unclaimedDividends = 0;
    }

    /* ======== VIEW FUNCTIONS ======== */

    /**
     * gets the balance of the contract
     */
    function getBalance() public view returns (uint256) {
        return IERC20(depositToken).balanceOf(address(this));
    }

    /* ======== PRIVATE ======== */

    /**
     * update investors totalShareCount to reflect any vested investments
     totalShareCount is used to determine rewards per share 
     */
    function updateInvestors() private {
        for (uint32 i = 0; i < accounts.length; i++) {
            address currentHolder = accounts[i];
            Investor storage investor = investors[currentHolder];

            for (uint32 x = 0; x < investor.investments.length; x++) {
                if (
                    !investor.investments[x].vested || // if it's vested then bypass
                    getDaysPassed(investor.investments[x].created) >=
                    VESTING_PERIOD
                ) {
                    investor.investments[x].vested = true;

                    // update investor share count
                    investor.totalShareCount = investor.totalShareCount.add(
                        investor.investments[x].shareCount
                    );
                }
            }
        }
    }

    /**
     * get days passed from date till block.timestamp (now)
     */
    function getDaysPassed(uint256 date) private view returns (uint256) {
        (, uint256 value) = block.timestamp.trySub(date);
        return value / 1 days;
    }
}
