// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Dai is ERC20, ERC20Burnable, Ownable {
    constructor() ERC20("Dai Stablecoin", "DAI") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}