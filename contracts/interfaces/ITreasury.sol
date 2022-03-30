// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

interface ITreasury {
    function deposit(uint256 _amount, address _token) external returns (bool);
}
