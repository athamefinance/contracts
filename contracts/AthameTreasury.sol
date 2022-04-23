// contracts/AthameTreasury.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/ITreasury.sol";

contract AthameTreasury is ITreasury, Ownable, AccessControl {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    /* ======== EVENTS ======== */
    event Deposit(address indexed token, uint256 amount);
    event Withdrawal(address indexed token, uint256 amount);

    /* ======== CONSTANTS ======== */
    bytes32 public constant LIQUIDITYTOKEN = keccak256("LIQUIDITYTOKEN");
    bytes32 public constant DEPOSITOR = keccak256("DEPOSITOR");

    /* ======== STATE VARIABLES ======== */
    uint256 public totalReserves;
    string internal notManager = "Treasury: not admin";
    string internal invalidToken = "Treasury: invalid token";

    /* ======== INITIALIZATION ======== */

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /* ======== MAIN FUNCTIONS ======== */

    function withdraw(uint256 _amount, address _token) external {
        require(hasRole(LIQUIDITYTOKEN, _token), invalidToken);
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), notManager);

        IERC20(_token).safeTransfer(msg.sender, _amount);

        totalReserves = totalReserves.sub(_amount);

        emit Withdrawal(_token, _amount);
    }

    function deposit(uint256 _amount, address _token) external returns (bool) {
        require(hasRole(LIQUIDITYTOKEN, _token), invalidToken);
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
                hasRole(DEPOSITOR, msg.sender),
            notManager
        );

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        totalReserves = totalReserves.add(_amount);

        emit Deposit(_token, _amount);

        return true;
    }

    /* ======== VIEW FUNCTIONS ======== */

    /**
     * gets the balance of the contract
     */
    function getBalance(address _token) public view returns (uint256) {
        require(hasRole(LIQUIDITYTOKEN, _token), invalidToken);
        return IERC20(_token).balanceOf(address(this));
    }
}
