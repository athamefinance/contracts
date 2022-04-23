// contracts/AthameDepository.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IERC20Mintable.sol";
import "./interfaces/ITreasury.sol";

contract AthameDepository is AccessControl, Pausable, ReentrancyGuard {
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

    /* ======== CONSTANTS ======== */
    bytes32 public constant DEPOSITOR = keccak256("DEPOSITOR");

    /* ======== STRUCTS ======== */
    struct Investor {
        address account;
        uint256 totalShareCount; // sum of all shares
        uint256 unclaimedDividends; // dividends waiting to be claimed
        Investment[] investments;
    }

    struct Investment {
        bool vested;
        uint48 created;
        // after the vesting period this will be added to the totalShareCount
        // which is used to distribute dividends
        uint256 shareCount; // shares purchased
    }

    /* ======== STATE VARIABLES ======== */
    address public treasury; // contract address that receives deposits
    address public depositToken; // token allowed for deposits
    /* solhint-disable var-name-mixedcase */
    address public ATHAME; // token used for voting privileges
    address public feeCollector;
    mapping(address => Investor) public investors; // keeps track of investors and shares per account
    address[] private accounts; // list of all accounts or keys within investors
    uint256 public immutable vestingPeriod;
    uint256 public immutable fee; // as % of deposit in hundreths. (100 = 10% = 0.1)
    uint256 public totalClaimed; // total claimed
    uint256 public totalUnclaimed; // waiting to be claimed
    uint256 public totalShareCount; // sum of investor shares
    uint256 public sharePrice; // the price per share
    string internal notManager = "Depository: not admin";

    /* ======== INITIALIZATION ======== */

    constructor(
        address _treasury,
        address _athame,
        address _depositToken,
        address _feeCollector,
        uint256 _sharePrice
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        _pause(); // initialize paused

        feeCollector = _feeCollector;
        treasury = _treasury;
        ATHAME = _athame;
        depositToken = _depositToken;
        sharePrice = _sharePrice;

        // defaults
        fee = 100;
        vestingPeriod = 7 days;
    }

    /* ======== POLICY FUNCTIONS ======== */
    function pause() external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), notManager);
        _pause();
    }

    function unpause() external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), notManager);
        _unpause();
    }

    function setDepositToken(address _token) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), notManager);
        depositToken = _token;
    }

    function setSharePrice(uint256 _value) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), notManager);
        sharePrice = _value;
    }

    /* ======== MAIN FUNCTIONS ======== */

    /**
     * update investor totalShareCount to reflect any vested investments
     totalShareCount is used to determine rewards per share
     */
    function updateInvestorShares(address _account, uint256[] memory _indexes)
        external
    {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
                hasRole(DEPOSITOR, msg.sender),
            notManager
        );
        Investor storage investor = investors[_account];

        for (uint32 x = 0; x < _indexes.length; x++) {
            uint256 index = _indexes[x];
            investor.investments[index].vested = true;

            // update investor share count
            investor.totalShareCount = investor.totalShareCount.add(
                investor.investments[index].shareCount
            );
        }
    }

    function deposit(uint256 _amount) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
                hasRole(DEPOSITOR, msg.sender),
            notManager
        );
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
        IERC20(depositToken).safeTransferFrom(
            msg.sender,
            feeCollector,
            totalFee
        );

        totalUnclaimed = totalUnclaimed.add(finalAmount);

        emit Deposit(finalAmount);
    }

    /**
     * update investor totalShareCount to reflect any vested investments
     totalShareCount is used to determine rewards per share
     */
    function updateInvestorDividends(address _account, uint256 _rewardPerShare)
        external
    {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
                hasRole(DEPOSITOR, msg.sender),
            notManager
        );
        Investor storage investor = investors[_account];

        // Calculate the reward
        uint256 rewardToBeDistributed = _rewardPerShare *
            investor.totalShareCount;

        investor.unclaimedDividends = investor.unclaimedDividends.add(
            rewardToBeDistributed
        );
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
        }

        // send investor 1 governance token per share
        IERC20Mintable(ATHAME).mint(
            msg.sender,
            _shareCount * 10**ERC20(ATHAME).decimals()
        );

        // update investor share count
        investors[msg.sender].investments.push(
            Investment({
                created: uint48(block.timestamp),
                shareCount: _shareCount,
                vested: false
            })
        );

        emit OnInvestment(_shareCount, sharePrice.mul(_shareCount), msg.sender);
    }

    function claim() external nonReentrant {
        Investor storage investor = investors[msg.sender];
        uint256 contractBalance = IERC20(depositToken).balanceOf(address(this));

        require(investor.unclaimedDividends > 0, "nothing to claim");
        require(
            contractBalance >= investor.unclaimedDividends,
            "not enough liquidity"
        );

        uint256 unclaimed = investor.unclaimedDividends;
        investor.unclaimedDividends = 0;

        IERC20(depositToken).safeTransfer(msg.sender, unclaimed);
        totalUnclaimed = totalUnclaimed.sub(unclaimed);
        totalClaimed = totalClaimed.add(unclaimed);

        emit Claim(msg.sender, unclaimed);
    }

    /* ======== VIEW FUNCTIONS ======== */

    function getRewardPerShare(uint256 _amount) public view returns (uint256) {
        uint256 rewardPerShare = 0;
        // fee
        uint256 totalFee = _amount.mul(fee).div(1000);
        uint256 finalAmount = _amount.sub(totalFee);

        uint256 vestedShares = getVestedShares();

        if (vestedShares > 0) {
            // Reward per share
            rewardPerShare = finalAmount / vestedShares;
        }

        return rewardPerShare;
    }

    /**
     * gets the balance of the contract
     */
    function getBalance() public view returns (uint256) {
        return IERC20(depositToken).balanceOf(address(this));
    }

    function getAccountCount() public view returns (uint256 count) {
        return accounts.length;
    }

    function getAccountAtIndex(uint256 _index)
        public
        view
        returns (address accountAddress)
    {
        require(_index >= 0 && _index < accounts.length, "index out of range");

        return accounts[_index];
    }

    function indexesFor(address _account)
        public
        view
        returns (uint256[] memory)
    {
        Investor memory investor = investors[_account];

        uint256 length;
        for (uint256 i = 0; i < investor.investments.length; i++) {
            if (
                !investor.investments[i].vested || // if it's vested then bypass
                getDaysPassed(investor.investments[i].created) >= vestingPeriod
            ) {
                length++;
            }
        }

        uint256[] memory indexes = new uint256[](length);
        uint256 position = 0;

        for (uint256 i = 0; i < investor.investments.length; i++) {
            if (
                !investor.investments[i].vested || // if it's vested then bypass
                getDaysPassed(investor.investments[i].created) >= vestingPeriod
            ) {
                indexes[position] = i;
                position++;
            }
        }

        return indexes;
    }

    /* ======== PRIVATE ======== */
    function getVestedShares() public view returns (uint256) {
        uint256 vestedShares = 0;

        // get total vested shares
        for (uint32 i = 0; i < accounts.length; i++) {
            address currentHolder = accounts[i];
            Investor memory investor = investors[currentHolder];
            vestedShares = vestedShares.add(investor.totalShareCount);
        }

        return vestedShares;
    }

    /**
     * get days passed from date till block.timestamp (now)
     */
    function getDaysPassed(uint256 date) private view returns (uint256) {
        (, uint256 value) = block.timestamp.trySub(date);
        return value / 1 days;
    }
}
