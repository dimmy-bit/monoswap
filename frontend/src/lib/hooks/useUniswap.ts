import { useCallback, useEffect, useMemo } from 'react'
import { ethers } from 'ethers'
import { useWeb3 } from '@/lib/web3/Web3Provider'
import TokenCache from '../utils/TokenCache'
import TransactionManager from '../utils/TransactionManager'
import { 
  ERC20_ABI,
  UNISWAP_V2_ROUTER_ABI,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI
} from '@/lib/contracts/abis'
import { SUPPORTED_TOKENS, UNISWAP_ADDRESSES, DEFAULT_DEADLINE } from '@/lib/config'

export function useUniswap() {
  const { address, provider } = useWeb3()
  const tokenCache = useMemo(() => TokenCache.getInstance(), [])
  const txManager = useMemo(() => TransactionManager.getInstance(), [])

  const router = useMemo(() => {
    if (!provider) return null
    return new ethers.Contract(
      UNISWAP_ADDRESSES.ROUTER,
      UNISWAP_V2_ROUTER_ABI,
      provider
    )
  }, [provider])

  const factory = useMemo(() => {
    if (!provider) return null
    return new ethers.Contract(
      UNISWAP_ADDRESSES.FACTORY,
      UNISWAP_V2_FACTORY_ABI,
      provider
    )
  }, [provider])

  const getTokenContract = useCallback((tokenAddress: string) => {
    if (!provider) return null
    return new ethers.Contract(tokenAddress, ERC20_ABI, provider)
  }, [provider])

  const getPairContract = async (tokenA: string, tokenB: string) => {
    if (!factory) return null
    const pairAddress = await factory.getPair(tokenA, tokenB)
    if (pairAddress === ethers.constants.AddressZero) return null
    return new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, provider?.getSigner())
  }

  const getAmountOut = useCallback(async (
    amountIn: string,
    tokenIn: string,
    tokenOut: string
  ) => {
    if (!router || !amountIn || !tokenIn || !tokenOut) return null

    try {
      const tokenInData = SUPPORTED_TOKENS[tokenIn as keyof typeof SUPPORTED_TOKENS]
      const tokenOutData = SUPPORTED_TOKENS[tokenOut as keyof typeof SUPPORTED_TOKENS]
      
      if (!tokenInData || !tokenOutData) return null

      const path = [
        tokenInData.address === '0x0000000000000000000000000000000000000000' 
          ? UNISWAP_ADDRESSES.WMON 
          : tokenInData.address,
        tokenOutData.address === '0x0000000000000000000000000000000000000000'
          ? UNISWAP_ADDRESSES.WMON
          : tokenOutData.address
      ]

      // Check if pool exists
      const poolAddress = await factory?.getPair(path[0], path[1])
      if (!poolAddress || poolAddress === ethers.constants.AddressZero) {
        throw new Error('Liquidity pool does not exist')
      }

      // Get pool contract
      const poolContract = new ethers.Contract(
        poolAddress,
        ['function getReserves() external view returns (uint112, uint112, uint32)'],
        provider
      )

      // Check if pool has liquidity
      const [reserve0, reserve1] = await poolContract.getReserves()
      if (reserve0.isZero() || reserve1.isZero()) {
        throw new Error('Insufficient liquidity in pool')
      }

      const amountInWei = ethers.utils.parseUnits(amountIn, tokenInData.decimals)
      const amounts = await router.getAmountsOut(amountInWei, path)
      return ethers.utils.formatUnits(amounts[1], tokenOutData.decimals)
    } catch (error) {
      console.error('Error getting amount out:', error)
      if (error instanceof Error) {
        throw new Error(error.message)
      }
      return null
    }
  }, [router, factory, provider])

  const swap = useCallback(async (
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    slippage: number = 0.5
  ) => {
    if (!router || !address || !provider) throw new Error('Not connected')

    const tokenInData = SUPPORTED_TOKENS[tokenIn as keyof typeof SUPPORTED_TOKENS]
    const tokenOutData = SUPPORTED_TOKENS[tokenOut as keyof typeof SUPPORTED_TOKENS]
    
    if (!tokenInData || !tokenOutData) throw new Error('Invalid tokens')

    const path = [
      tokenInData.address === '0x0000000000000000000000000000000000000000' 
        ? UNISWAP_ADDRESSES.WMON 
        : tokenInData.address,
      tokenOutData.address === '0x0000000000000000000000000000000000000000'
        ? UNISWAP_ADDRESSES.WMON
        : tokenOutData.address
    ]

    const amountInWei = ethers.utils.parseUnits(amountIn, tokenInData.decimals)
    const amounts = await router.getAmountsOut(amountInWei, path)
    const amountOutMin = amounts[1].mul(1000 - Math.floor(slippage * 10)).div(1000)
    const deadline = Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE

    // If tokenIn is native MONAD
    if (tokenInData.address === '0x0000000000000000000000000000000000000000') {
      const tx = await router.connect(provider.getSigner()).swapExactETHForTokens(
        amountOutMin,
        path,
        address,
        deadline,
        { value: amountInWei }
      )
      return tx
    }
    
    // If tokenOut is native MONAD
    if (tokenOutData.address === '0x0000000000000000000000000000000000000000') {
      const token = getTokenContract(tokenInData.address)
      if (!token) throw new Error('Token contract not found')

      const allowance = await token.allowance(address, UNISWAP_ADDRESSES.ROUTER)
      if (allowance.lt(amountInWei)) {
        const approveTx = await token.connect(provider.getSigner()).approve(
          UNISWAP_ADDRESSES.ROUTER,
          ethers.constants.MaxUint256
        )
        await approveTx.wait()
      }

      const tx = await router.connect(provider.getSigner()).swapExactTokensForETH(
        amountInWei,
        amountOutMin,
        path,
        address,
        deadline
      )
      return tx
    }
    
    // If both are ERC20 tokens
    const token = getTokenContract(tokenInData.address)
    if (!token) throw new Error('Token contract not found')

    const allowance = await token.allowance(address, UNISWAP_ADDRESSES.ROUTER)
    if (allowance.lt(amountInWei)) {
      const approveTx = await token.connect(provider.getSigner()).approve(
        UNISWAP_ADDRESSES.ROUTER,
        ethers.constants.MaxUint256
      )
      await approveTx.wait()
    }

    const tx = await router.connect(provider.getSigner()).swapExactTokensForTokens(
      amountInWei,
      amountOutMin,
      path,
      address,
      deadline
    )
    return tx
  }, [router, address, provider, getTokenContract])

  const getReserves = useCallback(async (tokenASymbol: string, tokenBSymbol: string) => {
    if (!factory || !provider) return [ethers.BigNumber.from(0), ethers.BigNumber.from(0)]

    try {
      const tokenAData = SUPPORTED_TOKENS[tokenASymbol as keyof typeof SUPPORTED_TOKENS]
      const tokenBData = SUPPORTED_TOKENS[tokenBSymbol as keyof typeof SUPPORTED_TOKENS]

      if (!tokenAData || !tokenBData) {
        throw new Error('Invalid tokens')
      }

      const tokenAAddress = tokenAData.address === '0x0000000000000000000000000000000000000000'
        ? UNISWAP_ADDRESSES.WMON
        : tokenAData.address

      const tokenBAddress = tokenBData.address === '0x0000000000000000000000000000000000000000'
        ? UNISWAP_ADDRESSES.WMON
        : tokenBData.address

      const pairAddress = await factory.getPair(tokenAAddress, tokenBAddress)
      if (pairAddress === ethers.constants.AddressZero) {
        return [ethers.BigNumber.from(0), ethers.BigNumber.from(0)]
      }

      const pair = new ethers.Contract(
        pairAddress,
        ['function getReserves() external view returns (uint112, uint112, uint32)'],
        provider
      )

      const [reserve0, reserve1] = await pair.getReserves()
      const [token0, token1] = tokenAAddress.toLowerCase() < tokenBAddress.toLowerCase()
        ? [tokenAAddress, tokenBAddress]
        : [tokenBAddress, tokenAAddress]

      return tokenAAddress.toLowerCase() === token0.toLowerCase()
        ? [reserve0, reserve1]
        : [reserve1, reserve0]
    } catch (error) {
      console.error('Error getting reserves:', error)
      return [ethers.BigNumber.from(0), ethers.BigNumber.from(0)]
    }
  }, [factory, provider])

  const addLiquidity = useCallback(async (
    tokenASymbol: string,
    tokenBSymbol: string,
    amountA: string,
    amountB: string,
    slippage: string,
    options?: { gasLimit?: number }
  ) => {
    if (!provider || !address) {
      throw new Error('Provider or account not connected')
    }

    const signer = provider.getSigner()
    const router = new ethers.Contract(UNISWAP_ADDRESSES.ROUTER, UNISWAP_V2_ROUTER_ABI, signer)

    // Get token data
    const tokenAData = SUPPORTED_TOKENS[tokenASymbol as keyof typeof SUPPORTED_TOKENS]
    const tokenBData = SUPPORTED_TOKENS[tokenBSymbol as keyof typeof SUPPORTED_TOKENS]

    if (!tokenAData || !tokenBData) {
      throw new Error('Invalid tokens')
    }

    // Convert amounts to BigNumber with proper decimals
    const amountADesired = ethers.utils.parseUnits(amountA, tokenAData.decimals)
    const amountBDesired = ethers.utils.parseUnits(amountB, tokenBData.decimals)

    // Calculate minimum amounts based on slippage
    const slippageBips = Math.floor(parseFloat(slippage) * 100)
    const amountAMin = amountADesired.mul(10000 - slippageBips).div(10000)
    const amountBMin = amountBDesired.mul(10000 - slippageBips).div(10000)

    // Set deadline 20 minutes from now
    const deadline = Math.floor(Date.now() / 1000) + 1200

    // Check if one of the tokens is the native token (MON)
    const isTokenANative = tokenAData.address === '0x0000000000000000000000000000000000000000'
    const isTokenBNative = tokenBData.address === '0x0000000000000000000000000000000000000000'

    try {
      if (isTokenANative || isTokenBNative) {
        // Handle native token (MON) + ERC20 token case
        const token = isTokenANative ? tokenBData.address : tokenAData.address
        const tokenAmount = isTokenANative ? amountBDesired : amountADesired
        const monAmount = isTokenANative ? amountADesired : amountBDesired
        const tokenAmountMin = isTokenANative ? amountBMin : amountAMin
        const monAmountMin = isTokenANative ? amountAMin : amountBMin

        // Check and approve ERC20 token
        const tokenContract = new ethers.Contract(token, ERC20_ABI, signer)
        const allowance = await tokenContract.allowance(address, UNISWAP_ADDRESSES.ROUTER)
        
        if (allowance.lt(tokenAmount)) {
          console.log('Approving token for router...')
          const approveTx = await tokenContract.approve(
            UNISWAP_ADDRESSES.ROUTER,
            ethers.constants.MaxUint256
          )
          await approveTx.wait()
          console.log('Token approved')
        }

        // Add liquidity with MON
        const overrides = {
          value: monAmount,
          gasLimit: options?.gasLimit || 500000
        }

        return await router.addLiquidityETH(
          token,
          tokenAmount,
          tokenAmountMin,
          monAmountMin,
          address,
          deadline,
          overrides
        )
      } else {
        // Handle ERC20 + ERC20 case
        // Check and approve both tokens
        const tokenAContract = new ethers.Contract(tokenAData.address, ERC20_ABI, signer)
        const tokenBContract = new ethers.Contract(tokenBData.address, ERC20_ABI, signer)

        const [allowanceA, allowanceB] = await Promise.all([
          tokenAContract.allowance(address, UNISWAP_ADDRESSES.ROUTER),
          tokenBContract.allowance(address, UNISWAP_ADDRESSES.ROUTER)
        ])

        const approvalPromises = []
        if (allowanceA.lt(amountADesired)) {
          console.log('Approving token A for router...')
          approvalPromises.push(
            tokenAContract.approve(UNISWAP_ADDRESSES.ROUTER, ethers.constants.MaxUint256)
          )
        }
        if (allowanceB.lt(amountBDesired)) {
          console.log('Approving token B for router...')
          approvalPromises.push(
            tokenBContract.approve(UNISWAP_ADDRESSES.ROUTER, ethers.constants.MaxUint256)
          )
        }

        if (approvalPromises.length > 0) {
          const approvalTxs = await Promise.all(approvalPromises)
          await Promise.all(approvalTxs.map(tx => tx.wait()))
          console.log('Tokens approved')
        }

        return await router.addLiquidity(
          tokenAData.address,
          tokenBData.address,
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          address,
          deadline,
          {
            gasLimit: options?.gasLimit || 500000
          }
        )
      }
    } catch (error: any) {
      console.error('Error in addLiquidity:', error)
      if (error.message.includes('INSUFFICIENT_B_AMOUNT')) {
        throw new Error('Insufficient token B amount. Please adjust the ratio.')
      }
      throw error
    }
  }, [provider, address])

  const removeLiquidity = async (
    tokenA: string,
    tokenB: string,
    liquidity: string,
    slippage: number = 0.5 // 0.5% default slippage
  ) => {
    if (!router || !address) throw new Error('Router or account not available')

    // Get pair contract
    const pair = await getPairContract(
      SUPPORTED_TOKENS[tokenA].address,
      SUPPORTED_TOKENS[tokenB].address
    )
    if (!pair) throw new Error('Pair not found')

    // Check and approve allowance if needed
    const allowance = await pair.allowance(address, UNISWAP_ADDRESSES.ROUTER)
    const liquidityAmount = ethers.utils.parseUnits(liquidity, 18) // LP tokens have 18 decimals
    
    if (allowance.lt(liquidityAmount)) {
      const approveTx = await pair.approve(UNISWAP_ADDRESSES.ROUTER, liquidityAmount)
      await approveTx.wait()
    }

    // Get reserves to calculate minimum amounts
    const reserves = await pair.getReserves()
    const totalSupply = await pair.totalSupply()
    
    const amountAMin = reserves[0].mul(liquidityAmount).div(totalSupply)
      .mul(1000 - slippage * 10).div(1000)
    const amountBMin = reserves[1].mul(liquidityAmount).div(totalSupply)
      .mul(1000 - slippage * 10).div(1000)

    // Remove liquidity
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes
    const tx = await router.removeLiquidity(
      SUPPORTED_TOKENS[tokenA].address,
      SUPPORTED_TOKENS[tokenB].address,
      liquidityAmount,
      amountAMin,
      amountBMin,
      address,
      deadline
    )

    return tx
  }

  const verifyUniswapContracts = async () => {
    if (!provider) {
      console.error('Provider not available for contract verification')
      return { factoryExists: false, routerExists: false, error: 'Provider not available' }
    }

    try {
      console.log('Verifying Uniswap V2 contracts on Monad testnet...')
      console.log('Factory address:', UNISWAP_ADDRESSES.FACTORY)
      console.log('Router address:', UNISWAP_ADDRESSES.ROUTER)

      // Get bytecode for Factory
      const factoryCode = await provider.getCode(UNISWAP_ADDRESSES.FACTORY)
      const factoryExists = factoryCode !== '0x'
      console.log('Factory contract exists:', factoryExists)
      if (factoryExists) {
        console.log('Factory bytecode length:', (factoryCode.length - 2) / 2, 'bytes')
        try {
          const factory = new ethers.Contract(
            UNISWAP_ADDRESSES.FACTORY,
            UNISWAP_V2_FACTORY_ABI,
            provider
          )
          const feeTo = await factory.feeTo()
          const allPairsLength = await factory.allPairsLength()
          console.log('Factory interface verified:')
          console.log('- feeTo:', feeTo)
          console.log('- Total pairs:', allPairsLength.toString())
        } catch (error) {
          console.error('Error verifying factory interface:', error)
          return { factoryExists: false, routerExists: false, error: 'Factory interface verification failed' }
        }
      } else {
        console.error('Factory contract not found at address:', UNISWAP_ADDRESSES.FACTORY)
        return { factoryExists: false, routerExists: false, error: 'Factory contract not found' }
      }

      // Get bytecode for Router
      const routerCode = await provider.getCode(UNISWAP_ADDRESSES.ROUTER)
      const routerExists = routerCode !== '0x'
      console.log('Router contract exists:', routerExists)
      if (routerExists) {
        console.log('Router bytecode length:', (routerCode.length - 2) / 2, 'bytes')
        try {
          const router = new ethers.Contract(
            UNISWAP_ADDRESSES.ROUTER,
            UNISWAP_V2_ROUTER_ABI,
            provider
          )
          const factoryAddress = await router.factory()
          const weth = await router.WETH()
          console.log('Router interface verified:')
          console.log('- Factory address:', factoryAddress)
          console.log('- WETH address:', weth)
        } catch (error) {
          console.error('Error verifying router interface:', error)
          return { factoryExists: true, routerExists: false, error: 'Router interface verification failed' }
        }
      } else {
        console.error('Router contract not found at address:', UNISWAP_ADDRESSES.ROUTER)
        return { factoryExists: true, routerExists: false, error: 'Router contract not found' }
      }

      return { factoryExists, routerExists, error: null }
    } catch (error) {
      console.error('Error verifying Uniswap contracts:', error)
      return { factoryExists: false, routerExists: false, error: 'Contract verification failed' }
    }
  }

  const createPair = useCallback(async (tokenASymbol: string, tokenBSymbol: string) => {
    if (!factory || !provider) throw new Error('Provider not connected')

    const tokenA = SUPPORTED_TOKENS[tokenASymbol as keyof typeof SUPPORTED_TOKENS]
    const tokenB = SUPPORTED_TOKENS[tokenBSymbol as keyof typeof SUPPORTED_TOKENS]

    if (!tokenA || !tokenB) throw new Error('Invalid tokens')

    const tokenAAddress = tokenA.address === '0x0000000000000000000000000000000000000000' 
      ? UNISWAP_ADDRESSES.WMON 
      : tokenA.address

    const tokenBAddress = tokenB.address === '0x0000000000000000000000000000000000000000'
      ? UNISWAP_ADDRESSES.WMON
      : tokenB.address

    try {
      const tx = await factory.connect(provider.getSigner()).createPair(tokenAAddress, tokenBAddress)
      return tx
    } catch (error) {
      console.error('Error creating pair:', error)
      throw error
    }
  }, [factory, provider])

  const getPair = useCallback(async (tokenASymbol: string, tokenBSymbol: string) => {
    if (!factory || !provider) return null

    try {
      const tokenA = SUPPORTED_TOKENS[tokenASymbol as keyof typeof SUPPORTED_TOKENS]
      const tokenB = SUPPORTED_TOKENS[tokenBSymbol as keyof typeof SUPPORTED_TOKENS]

      if (!tokenA || !tokenB) return null

      const tokenAAddress = tokenA.address === '0x0000000000000000000000000000000000000000' 
        ? UNISWAP_ADDRESSES.WMON 
        : tokenA.address

      const tokenBAddress = tokenB.address === '0x0000000000000000000000000000000000000000'
        ? UNISWAP_ADDRESSES.WMON
        : tokenB.address

      const pairAddress = await factory.getPair(tokenAAddress, tokenBAddress)
      return pairAddress !== ethers.constants.AddressZero ? pairAddress : null
    } catch (error) {
      console.error('Error getting pair:', error)
      return null
    }
  }, [factory, provider])

  return {
    verifyUniswapContracts,
    router,
    factory,
    getTokenContract,
    getPairContract,
    getAmountOut,
    swap,
    addLiquidity,
    removeLiquidity,
    getPair,
    createPair,
    getReserves
  }
} 