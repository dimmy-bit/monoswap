// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMonoFactory {
    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    function createPair(address tokenA, address tokenB) external returns (address pair);
    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function allPairs(uint) external view returns (address pair);
    function allPairsLength() external view returns (uint);
    function setFeeTo(address) external;
    function feeTo() external view returns (address);
} 