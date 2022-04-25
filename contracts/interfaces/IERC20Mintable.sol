// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

interface IERC20Mintable {
    function mint(address to, uint256 amount) external;
    function transferOwnership(address newOwner) external;
}
