// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MonoSwapPair is ERC20, ReentrancyGuard {
    IERC20 public token0;
    IERC20 public token1;
    
    uint public constant MINIMUM_LIQUIDITY = 10**3;
    uint public constant FEE_DENOMINATOR = 1000;
    uint public constant TRADING_FEE = 3; // 0.3%
    
    bool private initialized;
    address public factory;

    constructor() ERC20("MonoSwap-LP", "MONO-LP") {
        factory = msg.sender;
    }
    
    function initialize(address _token0, address _token1) external {
        require(msg.sender == factory, "MonoSwap: FORBIDDEN");
        require(!initialized, "MonoSwap: ALREADY_INITIALIZED");
        require(_token0 != address(0) && _token1 != address(0), "MonoSwap: ZERO_ADDRESS");
        
        // Ensure tokens are sorted
        (address token0_, address token1_) = _token0 < _token1 ? (_token0, _token1) : (_token1, _token0);
        token0 = IERC20(token0_);
        token1 = IERC20(token1_);
        initialized = true;
    }

    function getReserves() public view returns (uint112 reserve0, uint112 reserve1) {
        require(initialized, "MonoSwap: NOT_INITIALIZED");
        reserve0 = uint112(token0.balanceOf(address(this)));
        reserve1 = uint112(token1.balanceOf(address(this)));
    }

    function addLiquidity(uint amount0, uint amount1) external nonReentrant returns (uint liquidity) {
        require(amount0 > 0 && amount1 > 0, "MonoSwap: INSUFFICIENT_INPUT_AMOUNT");
        require(initialized, "MonoSwap: NOT_INITIALIZED");
        
        // Transfer tokens first
        require(token0.transferFrom(msg.sender, address(this), amount0), "TRANSFER_FROM_FAILED");
        require(token1.transferFrom(msg.sender, address(this), amount1), "TRANSFER_FROM_FAILED");
        
        (uint112 reserve0, uint112 reserve1) = getReserves();
        uint _totalSupply = totalSupply();

        if (_totalSupply == 0) {
            // Calculate liquidity
            liquidity = Math.sqrt(amount0 * amount1);
            require(liquidity > MINIMUM_LIQUIDITY, "MonoSwap: INSUFFICIENT_INITIAL_LIQUIDITY");
            
            // Mint minimum liquidity to dead address
            _mint(address(1), MINIMUM_LIQUIDITY);
            
            // Mint remaining liquidity to provider
            liquidity = liquidity - MINIMUM_LIQUIDITY;
            _mint(msg.sender, liquidity);
        } else {
            // Calculate liquidity based on existing reserves
            liquidity = Math.min(
                (amount0 * _totalSupply) / reserve0,
                (amount1 * _totalSupply) / reserve1
            );
            require(liquidity > 0, "MonoSwap: INSUFFICIENT_LIQUIDITY_MINTED");
            
            // Mint liquidity tokens
            _mint(msg.sender, liquidity);
        }
    }

    function removeLiquidity(uint liquidity) external nonReentrant returns (uint amount0, uint amount1) {
        require(liquidity > 0, "MonoSwap: INSUFFICIENT_LIQUIDITY_BURNED");
        require(initialized, "MonoSwap: NOT_INITIALIZED");
        
        (uint112 reserve0, uint112 reserve1) = getReserves();
        uint _totalSupply = totalSupply();
        
        amount0 = (liquidity * reserve0) / _totalSupply;
        amount1 = (liquidity * reserve1) / _totalSupply;
        
        require(amount0 > 0 && amount1 > 0, "MonoSwap: INSUFFICIENT_LIQUIDITY");
        
        _burn(msg.sender, liquidity);
        
        require(token0.transfer(msg.sender, amount0), "TRANSFER_FAILED");
        require(token1.transfer(msg.sender, amount1), "TRANSFER_FAILED");
    }

    function swap(uint amountIn, address tokenIn, uint minAmountOut) external nonReentrant returns (uint amountOut) {
        require(tokenIn == address(token0) || tokenIn == address(token1), "MonoSwap: INVALID_TOKEN");
        require(initialized, "MonoSwap: NOT_INITIALIZED");
        
        bool isToken0 = tokenIn == address(token0);
        (uint112 reserve0, uint112 reserve1) = getReserves();
        
        uint reserveIn = isToken0 ? reserve0 : reserve1;
        uint reserveOut = isToken0 ? reserve1 : reserve0;
        
        uint amountInWithFee = amountIn * (FEE_DENOMINATOR - TRADING_FEE);
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * FEE_DENOMINATOR + amountInWithFee);
        
        require(amountOut >= minAmountOut, "MonoSwap: INSUFFICIENT_OUTPUT_AMOUNT");
        
        if (isToken0) {
            require(token0.transferFrom(msg.sender, address(this), amountIn), "TRANSFER_FROM_FAILED");
            require(token1.transfer(msg.sender, amountOut), "TRANSFER_FAILED");
        } else {
            require(token1.transferFrom(msg.sender, address(this), amountIn), "TRANSFER_FROM_FAILED");
            require(token0.transfer(msg.sender, amountOut), "TRANSFER_FAILED");
        }
    }
}

library Math {
    function min(uint x, uint y) internal pure returns (uint z) {
        z = x < y ? x : y;
    }

    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
