// ... existing code ...
    struct SwapParams {
        uint amountIn;
        uint amountOutMin;
        address tokenIn;
        address tokenOut;
        address to;
        uint deadline;
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override returns (uint[] memory amounts) {
        require(deadline >= block.timestamp, "MonoSwap: EXPIRED");
        require(path.length == 2, "MonoSwap: INVALID_PATH_LENGTH");
        
        address pair = factory.getPair(path[0], path[1]);
        require(pair != address(0), "MonoSwap: PAIR_NOT_FOUND");
        
        // Approve pair to spend tokens if needed
        IERC20(path[0]).approve(pair, amountIn);
        
        // Transfer tokens to pair
        TransferHelper.safeTransferFrom(path[0], msg.sender, pair, amountIn);
        
        // Perform swap
        uint amountOut;
        {
            amountOut = MonoSwapPair(pair).swap{gas: 300000}(amountIn, path[0], amountOutMin);
        }
        
        // Return amounts
        amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }

    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable virtual override returns (uint[] memory amounts) {
        require(path[0] == WETH, "MonoSwap: INVALID_PATH");
        require(deadline >= block.timestamp, "MonoSwap: EXPIRED");
        require(path.length == 2, "MonoSwap: INVALID_PATH_LENGTH");
        
        address pair = factory.getPair(path[0], path[1]);
        require(pair != address(0), "MonoSwap: PAIR_NOT_FOUND");
        
        // Wrap ETH and approve pair
        IWETH(WETH).deposit{value: msg.value}();
        IWETH(WETH).approve(pair, msg.value);
        require(IWETH(WETH).transfer(pair, msg.value), "MonoSwap: TRANSFER_FAILED");
        
        // Perform swap
        uint amountOut;
        {
            amountOut = MonoSwapPair(pair).swap{gas: 300000}(msg.value, WETH, amountOutMin);
        }
        
        // Return amounts
        amounts = new uint[](2);
        amounts[0] = msg.value;
        amounts[1] = amountOut;
    }

    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override returns (uint[] memory amounts) {
        require(path[path.length - 1] == WETH, "MonoSwap: INVALID_PATH");
        require(deadline >= block.timestamp, "MonoSwap: EXPIRED");
        require(path.length == 2, "MonoSwap: INVALID_PATH_LENGTH");
        
        address pair = factory.getPair(path[0], path[1]);
        require(pair != address(0), "MonoSwap: PAIR_NOT_FOUND");
        
        // Approve pair to spend tokens
        IERC20(path[0]).approve(pair, amountIn);
        
        // Transfer tokens to pair
        TransferHelper.safeTransferFrom(path[0], msg.sender, pair, amountIn);
        
        // Perform swap
        uint amountOut;
        {
            amountOut = MonoSwapPair(pair).swap{gas: 300000}(amountIn, path[0], amountOutMin);
        }
        
        // Handle ETH conversion
        IWETH(WETH).withdraw(amountOut);
        TransferHelper.safeTransferETH(to, amountOut);
        
        // Return amounts
        amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }

    function _getReserves(
        address pair,
        address tokenA,
        address tokenB
    ) internal view returns (bool isToken0, uint reserveIn, uint reserveOut) {
        (address token0,) = MonoSwapLibrary.sortTokens(tokenA, tokenB);
        isToken0 = tokenA == token0;
        (uint reserve0, uint reserve1,) = MonoSwapPair(pair).getReserves();
        (reserveIn, reserveOut) = isToken0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    function _swap(
        address pair,
        uint amount0Out,
        uint amount1Out,
        address to
    ) internal {
        MonoSwapPair(pair).swap(amount0Out, amount1Out, to);
    }
// ... existing code ...