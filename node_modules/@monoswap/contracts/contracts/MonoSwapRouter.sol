// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./MonoSwapFactory.sol";
import "./MonoSwapPair.sol";

interface IWETH {
    function deposit() external payable;
    function withdraw(uint) external;
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address from, address to, uint value) external returns (bool);
    function approve(address spender, uint value) external returns (bool);
}

contract MonoSwapRouter {
    MonoSwapFactory public immutable factory;
    address public immutable WETH;
    
    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, "EXPIRED");
        _;
    }
    
    constructor(address _factory, address _WETH) {
        factory = MonoSwapFactory(_factory);
        WETH = _WETH;
    }
    
    receive() external payable {
        assert(msg.sender == WETH); // only accept ETH via fallback from the WETH contract
    }

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal returns (uint amountA, uint amountB) {
        // create the pair if it doesn't exist yet
        if (factory.getPair(tokenA, tokenB) == address(0)) {
            factory.createPair(tokenA, tokenB);
        }
        (amountA, amountB) = (amountADesired, amountBDesired);
    }

    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external virtual payable ensure(deadline) returns (uint amountToken, uint amountETH, uint liquidity) {
        // Create pair if it doesn't exist
        address pair = factory.getPair(token, WETH);
        if (pair == address(0)) {
            pair = factory.createPair(token, WETH);
        }
        require(pair != address(0), "MonoSwap: PAIR_CREATION_FAILED");

        // Calculate amounts
        amountToken = amountTokenDesired;
        amountETH = msg.value;

        // Transfer tokens to this contract first
        require(IERC20(token).transferFrom(msg.sender, address(this), amountToken), "MonoSwap: TOKEN_TRANSFER_FAILED");
        
        // Handle ETH wrapping
        IWETH(WETH).deposit{value: amountETH}();
        
        // Approve pair to take tokens
        require(IERC20(token).approve(pair, amountToken), "MonoSwap: TOKEN_APPROVAL_FAILED");
        require(IWETH(WETH).approve(pair, amountETH), "MonoSwap: WETH_APPROVAL_FAILED");

        // Check if this is initial liquidity
        (uint112 reserve0, uint112 reserve1) = MonoSwapPair(pair).getReserves();
        bool isInitialLiquidity = reserve0 == 0 && reserve1 == 0;

        if (isInitialLiquidity) {
            // For initial liquidity, use the full amounts
            liquidity = MonoSwapPair(pair).addLiquidity(
                token < WETH ? amountToken : amountETH,
                token < WETH ? amountETH : amountToken
            );
        } else {
            // For subsequent liquidity, calculate optimal amounts
            uint amountTokenOptimal = (amountETH * reserve0) / reserve1;
            if (amountTokenOptimal <= amountToken) {
                require(amountTokenOptimal >= amountTokenMin, "MonoSwap: INSUFFICIENT_TOKEN_AMOUNT");
                amountToken = amountTokenOptimal;
            } else {
                uint amountETHOptimal = (amountToken * reserve1) / reserve0;
                require(amountETHOptimal <= amountETH, "MonoSwap: EXCESSIVE_INPUT_AMOUNT");
                require(amountETHOptimal >= amountETHMin, "MonoSwap: INSUFFICIENT_ETH_AMOUNT");
                amountETH = amountETHOptimal;
            }

            // Add liquidity with optimal amounts
            liquidity = MonoSwapPair(pair).addLiquidity(
                token < WETH ? amountToken : amountETH,
                token < WETH ? amountETH : amountToken
            );
        }

        require(liquidity > 0, "MonoSwap: INSUFFICIENT_LIQUIDITY_MINTED");
        
        // Return any excess ETH
        if (msg.value > amountETH) {
            payable(msg.sender).transfer(msg.value - amountETH);
        }

        // Return any excess tokens
        if (amountToken < amountTokenDesired) {
            IERC20(token).transfer(msg.sender, amountTokenDesired - amountToken);
        }
    }

    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable ensure(deadline) returns (uint[] memory amounts) {
        require(path[0] == WETH, "MonoSwap: INVALID_PATH");
        require(path.length == 2, "MonoSwap: INVALID_PATH_LENGTH");
        require(msg.value > 0, "MonoSwap: INSUFFICIENT_INPUT_AMOUNT");
        
        // Get or create pair
        address pair = factory.getPair(path[0], path[1]);
        if (pair == address(0)) {
            pair = factory.createPair(path[0], path[1]);
        }
        require(pair != address(0), "MonoSwap: PAIR_CREATION_FAILED");
        
        // Check reserves and handle initial liquidity if needed
        (uint112 reserve0, uint112 reserve1) = MonoSwapPair(pair).getReserves();
        if (reserve0 == 0 && reserve1 == 0) {
            revert("MonoSwap: INSUFFICIENT_LIQUIDITY");
        }

        // Calculate amounts
        amounts = new uint[](2);
        amounts[0] = msg.value;
        
        // Calculate amount out with fee
        bool isToken0 = path[0] < path[1];
        uint reserveIn = isToken0 ? reserve0 : reserve1;
        uint reserveOut = isToken0 ? reserve1 : reserve0;
        
        uint amountInWithFee = amounts[0] * 997;
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = (reserveIn * 1000) + amountInWithFee;
        amounts[1] = numerator / denominator;
        
        require(amounts[1] >= amountOutMin, "MonoSwap: INSUFFICIENT_OUTPUT_AMOUNT");
        
        // Wrap ETH and approve pair
        IWETH(WETH).deposit{value: amounts[0]}();
        require(IWETH(WETH).approve(pair, amounts[0]), "MonoSwap: WETH_APPROVAL_FAILED");
        
        // Perform swap
        amounts[1] = MonoSwapPair(pair).swap(amounts[0], WETH, amountOutMin);
        
        // Transfer output tokens to recipient
        require(IERC20(path[1]).transfer(to, amounts[1]), "MonoSwap: TRANSFER_FAILED");
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to
    ) external returns (uint _amountA, uint _amountB, uint _liquidity) {
        address pair = factory.getPair(tokenA, tokenB);
        if (pair == address(0)) {
            pair = factory.createPair(tokenA, tokenB);
        }
        
        IERC20(tokenA).transferFrom(msg.sender, pair, amountADesired);
        IERC20(tokenB).transferFrom(msg.sender, pair, amountBDesired);
        _liquidity = MonoSwapPair(pair).addLiquidity(amountADesired, amountBDesired);
        
        require(_liquidity >= amountAMin && _liquidity >= amountBMin, "INSUFFICIENT_LIQUIDITY");
        
        if (to != address(this)) {
            MonoSwapPair(pair).transfer(to, _liquidity);
        }

        _amountA = amountADesired;
        _amountB = amountBDesired;
    }
    
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to
    ) external returns (uint amountA, uint amountB) {
        address pair = factory.getPair(tokenA, tokenB);
        require(pair != address(0), "PAIR_NOT_FOUND");
        
        MonoSwapPair(pair).transferFrom(msg.sender, pair, liquidity);
        (amountA, amountB) = MonoSwapPair(pair).removeLiquidity(liquidity);
        
        require(amountA >= amountAMin && amountB >= amountBMin, "INSUFFICIENT_AMOUNT");
        
        if (to != address(this)) {
            IERC20(tokenA).transfer(to, amountA);
            IERC20(tokenB).transfer(to, amountB);
        }
    }
    
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external ensure(deadline) returns (uint[] memory amounts) {
        require(path.length >= 2, "MonoSwap: INVALID_PATH");
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        
        // Handle single pair swap
        if (path.length == 2) {
            address pair = factory.getPair(path[0], path[1]);
            require(pair != address(0), "MonoSwap: PAIR_NOT_EXISTS");
            
            // Get reserves
            (uint112 reserve0, uint112 reserve1) = MonoSwapPair(pair).getReserves();
            require(reserve0 > 0 && reserve1 > 0, "MonoSwap: INSUFFICIENT_LIQUIDITY");
            
            // Calculate amount out with fee
            bool isToken0 = path[0] < path[1];
            uint reserveIn = isToken0 ? reserve0 : reserve1;
            uint reserveOut = isToken0 ? reserve1 : reserve0;
            
            uint amountInWithFee = amounts[0] * 997;
            uint numerator = amountInWithFee * reserveOut;
            uint denominator = (reserveIn * 1000) + amountInWithFee;
            amounts[1] = numerator / denominator;
            
            require(amounts[1] >= amountOutMin, "MonoSwap: INSUFFICIENT_OUTPUT_AMOUNT");
            
            // Transfer input tokens to pair and approve
            IERC20(path[0]).transferFrom(msg.sender, address(this), amounts[0]);
            IERC20(path[0]).approve(pair, amounts[0]);
            
            // Perform swap
            amounts[1] = MonoSwapPair(pair).swap(amounts[0], path[0], amountOutMin);
            
            // Transfer output tokens to recipient
            IERC20(path[1]).transfer(to, amounts[1]);
            
            return amounts;
        }
        
        // Handle multi-pair swaps
        for (uint i; i < path.length - 1; i++) {
            address pair = factory.getPair(path[i], path[i + 1]);
            require(pair != address(0), "MonoSwap: PAIR_NOT_EXISTS");
            
            // Get reserves
            (uint112 reserve0, uint112 reserve1) = MonoSwapPair(pair).getReserves();
            require(reserve0 > 0 && reserve1 > 0, "MonoSwap: INSUFFICIENT_LIQUIDITY");
            
            // Calculate amount out with fee
            bool isToken0 = path[i] < path[i + 1];
            uint reserveIn = isToken0 ? reserve0 : reserve1;
            uint reserveOut = isToken0 ? reserve1 : reserve0;
            
            uint amountInWithFee = amounts[i] * 997;
            uint numerator = amountInWithFee * reserveOut;
            uint denominator = (reserveIn * 1000) + amountInWithFee;
            amounts[i + 1] = numerator / denominator;
            
            // For first pair, transfer from sender to router
            if (i == 0) {
                IERC20(path[0]).transferFrom(msg.sender, address(this), amounts[0]);
            }
            
            // Approve pair to take tokens
            IERC20(path[i]).approve(pair, amounts[i]);
            
            // Perform swap
            amounts[i + 1] = MonoSwapPair(pair).swap(amounts[i], path[i], amounts[i + 1]);
        }
        
        require(amounts[path.length - 1] >= amountOutMin, "MonoSwap: INSUFFICIENT_OUTPUT_AMOUNT");
        
        // Transfer final tokens to recipient
        IERC20(path[path.length - 1]).transfer(to, amounts[path.length - 1]);
    }

    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external ensure(deadline) returns (uint[] memory amounts) {
        require(path[path.length - 1] == WETH, "MonoSwap: INVALID_PATH");
        require(path.length == 2, "MonoSwap: INVALID_PATH_LENGTH");
        
        address pair = factory.getPair(path[0], path[1]);
        require(pair != address(0), "MonoSwap: PAIR_NOT_EXISTS");
        
        // Calculate amounts
        amounts = new uint[](2);
        amounts[0] = amountIn;
        
        // Get reserves
        (uint112 reserve0, uint112 reserve1) = MonoSwapPair(pair).getReserves();
        require(reserve0 > 0 && reserve1 > 0, "MonoSwap: INSUFFICIENT_LIQUIDITY");
        
        // Calculate amount out with fee
        bool isToken0 = path[0] < path[1];
        uint reserveIn = isToken0 ? reserve0 : reserve1;
        uint reserveOut = isToken0 ? reserve1 : reserve0;
        
        uint amountInWithFee = amounts[0] * 997;
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = (reserveIn * 1000) + amountInWithFee;
        amounts[1] = numerator / denominator;
        
        require(amounts[1] >= amountOutMin, "MonoSwap: INSUFFICIENT_OUTPUT_AMOUNT");
        
        // Transfer input tokens to pair and approve
        IERC20(path[0]).transferFrom(msg.sender, address(this), amounts[0]);
        IERC20(path[0]).approve(pair, amounts[0]);
        
        // Perform swap
        amounts[1] = MonoSwapPair(pair).swap(amounts[0], path[0], amountOutMin);
        
        // Unwrap WETH and send ETH to recipient
        IWETH(WETH).withdraw(amounts[1]);
        (bool success,) = to.call{value: amounts[1]}("");
        require(success, "MonoSwap: ETH_TRANSFER_FAILED");
    }
}
