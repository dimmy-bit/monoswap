// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./MonoSwapPair.sol";

contract MonoSwapFactory {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;
    
    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "MonoSwap: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "MonoSwap: ZERO_ADDRESS");
        require(getPair[token0][token1] == address(0), "MonoSwap: PAIR_EXISTS");

        // Deploy new pair contract
        MonoSwapPair _pair = new MonoSwapPair();
        pair = address(_pair);
        
        // Initialize the pair
        MonoSwapPair(pair).initialize(token0, token1);
        
        // Store the pair mappings
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }
}
