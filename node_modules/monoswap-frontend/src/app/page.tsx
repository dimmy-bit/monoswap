'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { SEPOLIA_TOKENS } from '../config/tokens';
import Image from 'next/image';
import { getTokenPrices } from '../utils/priceUtils';
import { CONTRACT_ADDRESSES, ROUTER_ABI, FACTORY_ABI, PAIR_ABI } from '../config/contracts';
import TransactionHistory from '../components/TransactionHistory';
import useTransactionStore from '../stores/transactionStore';
import { Transaction } from '../types/transaction';
import TradingViewChart from '../components/TradingViewChart';
import TrendingTokens from '../components/TrendingTokens';
import { toast } from 'react-hot-toast';
import axios from 'axios';

// Add ABI for ERC20 and Router
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function balanceOf(address account) public view returns (uint256)'
];

const timeIntervals = ['1h', '4h', '1d', '1w', '1M'];

// Update the ChartData interface
interface ChartData {
  time: string;
  value: number;
}

const CRYPTOCOMPARE_API_KEY = process.env.NEXT_PUBLIC_CRYPTOCOMPARE_API_KEY;
const BASE_URL = 'https://min-api.cryptocompare.com/data';

export default function Home() {
  const [account, setAccount] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [balances, setBalances] = useState<{ [key: string]: string }>({});
  const [selectedTokenFrom, setSelectedTokenFrom] = useState(SEPOLIA_TOKENS[0]);
  const [selectedTokenTo, setSelectedTokenTo] = useState(SEPOLIA_TOKENS[1]);
  const [amountFrom, setAmountFrom] = useState('');
  const [amountTo, setAmountTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [prices, setPrices] = useState<{ [key: string]: number }>({});
  const [selectedInterval, setSelectedInterval] = useState('1h');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const { addTransaction, updateTransaction } = useTransactionStore();
  const [error, setError] = useState<string | null>(null);

  const connectWallet = async () => {
    // Dispatch a click event to the TrendingTokens connect button
    const connectButton = document.querySelector('[data-connect-wallet]');
    if (connectButton) {
      connectButton.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      }));
    }
  };

  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia chainId
      });
    } catch (err: any) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0xaa36a7',
            chainName: 'Sepolia Test Network',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          }],
        });
      } else {
        throw err;
      }
    }
  };

  const fetchBalances = async (address: string) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const ethBalance = await provider.getBalance(address);
      
      const newBalances: { [key: string]: string } = {
        ETH: ethers.formatEther(ethBalance)
      };

      // Fetch token balances
      for (const token of SEPOLIA_TOKENS) {
        if (token.symbol !== 'ETH') {
          const tokenContract = new ethers.Contract(
            token.address,
            ERC20_ABI,
            provider
          );
          
          try {
            const balance = await tokenContract.balanceOf(address);
            newBalances[token.symbol] = ethers.formatUnits(balance, token.decimals || 18);
          } catch (err) {
            console.error(`Error fetching ${token.symbol} balance:`, err);
            newBalances[token.symbol] = '0';
          }
        }
      }

      setBalances(newBalances);
    } catch (err: any) {
      console.error('Error fetching balances:', err);
      toast.error('Failed to fetch balances');
    }
  };

  const fetchPrices = async () => {
    try {
      const symbols = SEPOLIA_TOKENS.map(token => token.symbol);
      const priceData = await getTokenPrices(symbols);
      
      // Ensure we have prices for all tokens
      const validPrices: { [key: string]: number } = {};
      for (const token of SEPOLIA_TOKENS) {
        validPrices[token.symbol] = priceData[token.symbol] || 0;
      }
      
      setPrices(validPrices);
    } catch (err: any) {
      console.error('Error fetching prices:', err);
      toast.error('Failed to fetch prices');
    }
  };

  // Update price calculation
  const calculatePrice = (amountIn: string, tokenFrom: any, tokenTo: any) => {
    if (!amountIn || isNaN(parseFloat(amountIn))) return '0';
    if (!prices[tokenFrom.symbol] || !prices[tokenTo.symbol]) return '0';
    
    const priceFrom = prices[tokenFrom.symbol];
    const priceTo = prices[tokenTo.symbol];
    
    if (priceFrom === 0 || priceTo === 0) return '0';
    
    const amount = parseFloat(amountIn);
    const result = (amount * priceFrom) / priceTo;
    
    // Apply a 0.3% fee
    const resultWithFee = result * 0.997;
    
    // Return with appropriate decimal places
    return resultWithFee.toFixed(tokenTo.decimals || 6);
  };

  // Update useEffect for price calculation
  useEffect(() => {
    if (amountFrom && !isNaN(parseFloat(amountFrom))) {
      const calculatedAmount = calculatePrice(amountFrom, selectedTokenFrom, selectedTokenTo);
      setAmountTo(calculatedAmount);
    } else {
      setAmountTo('');
    }
  }, [amountFrom, selectedTokenFrom, selectedTokenTo, prices]);

  // Add event listener for wallet connection
  useEffect(() => {
    const handleWalletConnection = (event: any) => {
      const { address, chainId } = event.detail;
      setAccount(address);
      setIsConnected(true);
      fetchBalances(address);
    };

    const handleWalletDisconnection = () => {
      setAccount('');
      setIsConnected(false);
      setBalances({});
    };

    window.addEventListener('wallet-connected', handleWalletConnection);
    window.addEventListener('wallet-disconnected', handleWalletDisconnection);

    // Check if already connected
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          
          if (accounts.length > 0) {
            const address = accounts[0].address;
            setAccount(address);
            setIsConnected(true);
            
            // Check if we're on Sepolia network
            const network = await provider.getNetwork();
            const sepoliaChainId = '0xaa36a7';
            if (network.chainId.toString(16) !== sepoliaChainId.slice(2)) {
              await switchToSepolia();
            }
            
            // Fetch initial data
            await Promise.all([
              fetchBalances(address),
              fetchPrices()
            ]);
          }
        } catch (err) {
          console.error('Error checking connection:', err);
          setIsConnected(false);
          setAccount('');
        }
      }
    };

    checkConnection();

    // Add MetaMask event listeners
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          handleWalletDisconnection();
        } else {
          setAccount(accounts[0]);
          setIsConnected(true);
          fetchBalances(accounts[0]);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });

      window.ethereum.on('disconnect', () => {
        handleWalletDisconnection();
      });
    }

    return () => {
      window.removeEventListener('wallet-connected', handleWalletConnection);
      window.removeEventListener('wallet-disconnected', handleWalletDisconnection);
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', () => {});
        window.ethereum.removeListener('chainChanged', () => {});
        window.ethereum.removeListener('disconnect', () => {});
      }
    };
  }, []);

  const handleApproval = async (tokenAddress: string, amount: bigint) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      
      console.log('Checking allowance...');
      const currentAllowance = await token.allowance(signer.address, CONTRACT_ADDRESSES.ROUTER);
      
      if (currentAllowance < amount) {
        console.log('Approving tokens...');
        const tx = await token.approve(CONTRACT_ADDRESSES.ROUTER, amount);
        console.log('Approval transaction sent:', tx.hash);
        await tx.wait();
        console.log('Approval confirmed');
      } else {
        console.log('Sufficient allowance exists');
      }
      return true;
    } catch (err) {
      console.error('Approval error:', err);
      throw new Error('Failed to approve token');
    }
  };

  const handleSwap = async () => {
    if (!amountFrom || !amountTo || !isConnected) {
      toast.error('Please connect wallet and enter amounts');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      
      if (network.chainId.toString() !== '11155111') {
        await switchToSepolia();
        return;
      }

      const signer = await provider.getSigner();
      const router = new ethers.Contract(CONTRACT_ADDRESSES.ROUTER, ROUTER_ABI, signer);
      
      // Calculate amounts with proper decimals
      const amountInWei = ethers.parseUnits(amountFrom, selectedTokenFrom.decimals || 18);
      const amountOutMinWei = ethers.parseUnits(amountTo, selectedTokenTo.decimals || 18);
      const slippage = 0.05; // 5% slippage
      const amountOutMin = (amountOutMinWei * BigInt(95)) / BigInt(100);
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

      // Construct the swap path
      let path: string[];
      if (selectedTokenFrom.symbol === 'ETH') {
        path = [CONTRACT_ADDRESSES.WETH, selectedTokenTo.address];
      } else if (selectedTokenTo.symbol === 'ETH') {
        path = [selectedTokenFrom.address, CONTRACT_ADDRESSES.WETH];
      } else {
        path = [selectedTokenFrom.address, CONTRACT_ADDRESSES.WETH, selectedTokenTo.address];
      }

      // Add pending transaction immediately
      const pendingTx: Transaction = {
        hash: 'pending',
        type: 'SWAP',
        timestamp: Date.now(),
        status: 'pending',
        from: {
          symbol: selectedTokenFrom.symbol,
          amount: amountFrom
        },
        to: {
          symbol: selectedTokenTo.symbol,
          amount: amountTo
        }
      };
      addTransaction(pendingTx);

      let tx;
      const baseGasLimit = 300000; // Reduced from 500000 for optimization

      // Handle ETH to Token swap
      if (selectedTokenFrom.symbol === 'ETH') {
        tx = await router.swapExactETHForTokens(
          amountOutMin,
          path,
          signer.address,
          deadline,
          { 
            value: amountInWei,
            gasLimit: baseGasLimit
          }
        );
      } 
      // Handle Token to ETH swap
      else if (selectedTokenTo.symbol === 'ETH') {
        await handleApproval(selectedTokenFrom.address, amountInWei);
        tx = await router.swapExactTokensForETH(
          amountInWei,
          amountOutMin,
          path,
          signer.address,
          deadline,
          { gasLimit: baseGasLimit }
        );
      }
      // Handle Token to Token swap
      else {
        await handleApproval(selectedTokenFrom.address, amountInWei);
        tx = await router.swapExactTokensForTokens(
          amountInWei,
          amountOutMin,
          path,
          signer.address,
          deadline,
          { gasLimit: baseGasLimit }
        );
      }

      // Update transaction with actual hash
      updateTransaction('pending', {
        hash: tx.hash,
        status: 'pending'
      });

      await tx.wait();
      
      // Update transaction status and UI
      updateTransaction(tx.hash, { status: 'completed' });
      await fetchBalances(account);
      toast.success('Swap completed successfully!');
      
      // Clear inputs after successful swap
      setAmountFrom('');
      setAmountTo('');

    } catch (err: any) {
      console.error('Swap error:', err);
      let errorMessage = 'Swap failed';
      
      if (err.message.includes('insufficient allowance')) {
        errorMessage = 'Please approve token spending first';
      } else if (err.message.includes('insufficient balance')) {
        errorMessage = 'Insufficient balance for swap';
      } else if (err.code === 'ACTION_REJECTED') {
        errorMessage = 'Transaction rejected by user';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);

      // Update pending transaction as failed
      updateTransaction('pending', {
        status: 'failed',
        hash: err.transaction?.hash || 'failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update the fetchChartData function
  const fetchChartData = async (interval: string) => {
    try {
      setIsChartLoading(true);
      setError(null);
      
      // Get current ETH price
      const currentEthPrice = prices[selectedTokenFrom.symbol] || 0;
      
      // Get historical data from CryptoCompare
      const getHistoricalData = async () => {
        const limit = 100;
        let endpoint = '';
        let aggregate = 1;
        
        switch (interval) {
          case '1h':
            endpoint = 'histominute';
            aggregate = 1;
            break;
          case '4h':
            endpoint = 'histominute';
            aggregate = 4;
            break;
          case '1d':
            endpoint = 'histohour';
            aggregate = 1;
            break;
          case '1w':
            endpoint = 'histohour';
            aggregate = 4;
            break;
          case '1M':
            endpoint = 'histoday';
            aggregate = 1;
            break;
        }

        try {
          const response = await axios.get(`${BASE_URL}/${endpoint}`, {
            params: {
              fsym: selectedTokenFrom.symbol,
              tsym: selectedTokenTo.symbol,
              limit,
              aggregate,
              api_key: CRYPTOCOMPARE_API_KEY
            }
          });

          return response.data.Data.map((item: any) => ({
            time: item.time.toString(),
            value: item.close
          }));
        } catch (error) {
          console.error('Error fetching historical data:', error);
          return generateMockData(currentEthPrice, interval);
        }
      };

      const generateMockData = (basePrice: number, interval: string) => {
        const now = new Date();
        const mockData: ChartData[] = [];
        let lastPrice = basePrice;
        
        const getTimeRange = () => {
          switch (interval) {
            case '1h': return { increment: 60, periods: 60 }; // 1 minute intervals
            case '4h': return { increment: 240, periods: 60 }; // 4 minute intervals
            case '1d': return { increment: 1440, periods: 96 }; // 15 minute intervals
            case '1w': return { increment: 10080, periods: 168 }; // 1 hour intervals
            case '1M': return { increment: 43200, periods: 720 }; // 1 hour intervals
            default: return { increment: 60, periods: 60 };
          }
        };
        
        const { increment, periods } = getTimeRange();
        
        for (let i = 0; i < periods; i++) {
          const timestamp = new Date(now.getTime() - (periods - i) * increment * 60 * 1000);
          
          // Generate more realistic price movements
          const trend = Math.sin(i / 20) * 0.0005;
          const volatility = (Math.random() - 0.5) * 0.001;
          const momentum = (lastPrice - basePrice) * -0.05;
          const priceChange = trend + volatility + momentum;
          
          lastPrice = lastPrice * (1 + priceChange);
          lastPrice = Math.max(lastPrice, basePrice * 0.99);
          lastPrice = Math.min(lastPrice, basePrice * 1.01);
          
          mockData.push({
            time: Math.floor(timestamp.getTime() / 1000).toString(),
            value: parseFloat(lastPrice.toFixed(2))
          });
        }
        
        return mockData;
      };

      // Try to get real data first, fall back to mock data if needed
      const chartData = await getHistoricalData();
      setChartData(chartData);
    } catch (err: any) {
      console.error('Error generating chart data:', err);
      setError('Failed to load chart data');
      setChartData([]);
    } finally {
      setIsChartLoading(false);
    }
  };

  // Update price fetching interval
  useEffect(() => {
    const fetchPricesInterval = setInterval(async () => {
      await fetchPrices();
      if (selectedTokenFrom && selectedTokenTo) {
        await fetchChartData(selectedInterval);
      }
    }, 10000); // Update every 10 seconds

    return () => clearInterval(fetchPricesInterval);
  }, [selectedTokenFrom, selectedTokenTo]);

  const TokenImage = ({ src, alt }: { src: string, alt: string }) => {
    if (src.startsWith('data:')) {
      // For data URLs (like our MONO token logo)
      return (
        <div
          className="w-6 h-6 rounded-full bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${src})` }}
        />
      );
    }
    // For remote images (from CoinGecko)
    return (
      <Image
        src={src}
        alt={alt}
        width={24}
        height={24}
        className="rounded-full"
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Pass isConnected state to TrendingTokens */}
      <TrendingTokens isConnected={isConnected} account={account} />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart Section */}
          <div className="lg:col-span-2 bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">
                {`${selectedTokenFrom.symbol}/${selectedTokenTo.symbol}`}
              </h2>
              <div className="flex space-x-2">
                {timeIntervals.map((interval) => (
                  <button
                    key={interval}
                    onClick={() => {
                      setSelectedInterval(interval);
                      fetchChartData(interval);
                    }}
                    className={`px-3 py-1 rounded-lg text-sm ${
                      selectedInterval === interval
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {interval}
                  </button>
                ))}
              </div>
            </div>
            {isChartLoading ? (
              <div className="w-full h-[400px] flex items-center justify-center bg-gray-800/50 rounded-lg">
                <div className="text-gray-400">Loading chart...</div>
              </div>
            ) : (
              <TradingViewChart
                data={chartData}
                pair={`${selectedTokenFrom.symbol}/${selectedTokenTo.symbol}`}
              />
            )}
          </div>

          {/* Swap Interface */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Swap</h2>
              <div className="flex items-center space-x-2">
                <button className="p-2 hover:bg-gray-700 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
                <button className="p-2 hover:bg-gray-700 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Token Input Fields */}
            <div className="space-y-4">
              <div className="bg-gray-700/50 p-4 rounded-xl border border-gray-600">
                <div className="flex justify-between mb-2">
                  <input
                    type="number"
                    value={amountFrom}
                    onChange={(e) => setAmountFrom(e.target.value)}
                    placeholder="0.0"
                    className="w-2/3 bg-transparent outline-none text-2xl"
                  />
                  <div className="flex items-center space-x-2">
                    <img
                      src={selectedTokenFrom.logoURI}
                      alt={selectedTokenFrom.symbol}
                      className="w-6 h-6 rounded-full"
                    />
                    <select
                      value={selectedTokenFrom.symbol}
                      onChange={(e) => {
                        const token = SEPOLIA_TOKENS.find(t => t.symbol === e.target.value);
                        if (token) setSelectedTokenFrom(token);
                      }}
                      className="bg-gray-600/50 rounded-lg px-2 py-1 text-sm"
                    >
                      {SEPOLIA_TOKENS.map((token) => (
                        <option key={token.symbol} value={token.symbol}>
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  Balance: {balances[selectedTokenFrom.symbol]?.slice(0, 8) || '0'} {selectedTokenFrom.symbol}
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => {
                    const tempToken = selectedTokenFrom;
                    setSelectedTokenFrom(selectedTokenTo);
                    setSelectedTokenTo(tempToken);
                  }}
                  className="bg-gray-700/50 p-2 rounded-full hover:bg-gray-600/50"
                >
                  ↓
                </button>
              </div>

              <div className="bg-gray-700/50 p-4 rounded-xl border border-gray-600">
                <div className="flex justify-between mb-2">
                  <input
                    type="number"
                    value={amountTo}
                    onChange={(e) => setAmountTo(e.target.value)}
                    placeholder="0.0"
                    className="w-2/3 bg-transparent outline-none text-2xl"
                  />
                  <div className="flex items-center space-x-2">
                    <img
                      src={selectedTokenTo.logoURI}
                      alt={selectedTokenTo.symbol}
                      className="w-6 h-6 rounded-full"
                    />
                    <select
                      value={selectedTokenTo.symbol}
                      onChange={(e) => {
                        const token = SEPOLIA_TOKENS.find(t => t.symbol === e.target.value);
                        if (token) setSelectedTokenTo(token);
                      }}
                      className="bg-gray-600/50 rounded-lg px-2 py-1 text-sm"
                    >
                      {SEPOLIA_TOKENS.map((token) => (
                        <option key={token.symbol} value={token.symbol}>
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  Balance: {balances[selectedTokenTo.symbol]?.slice(0, 8) || '0'} {selectedTokenTo.symbol}
                </div>
              </div>
            </div>

            {/* Swap Button */}
            {!isConnected 
              ? <button
                  onClick={connectWallet}
                  className="w-full mt-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold py-3 px-4 rounded-xl hover:opacity-90"
                >
                  Connect Wallet
                </button>
              : <button
                  onClick={handleSwap}
                  disabled={isLoading || !amountFrom || !amountTo}
                  className={`w-full mt-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold py-3 px-4 rounded-xl 
                    ${(isLoading || !amountFrom || !amountTo) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                >
                  {isLoading ? 'Swapping...' : !amountFrom || !amountTo ? 'Enter Amount' : 'Swap'}
                </button>
            }

            {/* Price Information */}
            <div className="mt-4 text-sm text-gray-400">
              {prices[selectedTokenFrom.symbol] && prices[selectedTokenTo.symbol] && (
                <div>
                  1 {selectedTokenFrom.symbol} ≈ {(prices[selectedTokenFrom.symbol] / prices[selectedTokenTo.symbol]).toFixed(6)} {selectedTokenTo.symbol}
                  <span className="ml-2">
                    (${prices[selectedTokenFrom.symbol].toFixed(2)})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <TransactionHistory />
      </div>

      {error && (
        <div className="fixed top-4 right-4 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
} 