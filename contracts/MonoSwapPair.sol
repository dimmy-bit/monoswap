function swap(
    uint amountIn,
    address tokenIn,
    uint minAmountOut
) external nonReentrant returns (uint amountOut) {
    require(tokenIn == address(token0) || tokenIn == address(token1), "MonoSwap: INVALID_TOKEN");
    require(initialized, "MonoSwap: NOT_INITIALIZED");
    
    bool isToken0 = tokenIn == address(token0);
    (uint112 reserve0_, uint112 reserve1_,) = getReserves();
    
    // Calculate output amount
    uint reserveIn = isToken0 ? reserve0_ : reserve1_;
    uint reserveOut = isToken0 ? reserve1_ : reserve0_;
    uint amountInWithFee = amountIn * (FEE_DENOMINATOR - TRADING_FEE);
    amountOut = amountInWithFee * reserveOut / (reserveIn * FEE_DENOMINATOR + amountInWithFee);
    
    require(amountOut >= minAmountOut, "MonoSwap: INSUFFICIENT_OUTPUT_AMOUNT");
    
    // Handle transfers
    if (isToken0) {
        require(token0.transferFrom(msg.sender, address(this), amountIn), "MonoSwap: TRANSFER_FROM_FAILED");
        require(token1.transfer(msg.sender, amountOut), "MonoSwap: TRANSFER_FAILED");
    } else {
        require(token1.transferFrom(msg.sender, address(this), amountIn), "MonoSwap: TRANSFER_FROM_FAILED");
        require(token0.transfer(msg.sender, amountOut), "MonoSwap: TRANSFER_FAILED");
    }
    
    // Update reserves
    _update(
        token0.balanceOf(address(this)),
        token1.balanceOf(address(this))
    );
    
    return amountOut;
} 