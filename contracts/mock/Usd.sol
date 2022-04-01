// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Usd is ERC20, ERC20Burnable, Ownable {
    uint8 private constant TOKEN_DECIMALS = 6;

    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 1000000 * 10**decimals());
    }

    function decimals() public view virtual override returns (uint8) {
        return TOKEN_DECIMALS;
    }
}
