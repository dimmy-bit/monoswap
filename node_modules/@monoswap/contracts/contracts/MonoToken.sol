// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MonoToken is ERC20, Ownable {
    constructor(uint256 initialSupply) ERC20("MonoSwap Token", "MONO") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
        _transferOwnership(msg.sender);
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
