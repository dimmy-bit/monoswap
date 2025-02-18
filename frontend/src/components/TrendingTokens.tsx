import { useState, useEffect } from 'react';
import { SEPOLIA_TOKENS } from '../config/tokens';
import { getTokenPrices } from '../utils/priceUtils';
import { toast } from 'react-hot-toast';
import { ethers } from 'ethers';

interface TokenTrend {
  token: typeof SEPOLIA_TOKENS[0];
  price: number;
  priceChange: number;
}

interface TrendingTokensProps {
  isConnected: boolean;
  account: string;
}

export default function TrendingTokens({ isConnected: parentIsConnected, account: parentAccount }: TrendingTokensProps) {
  const [trendingTokens, setTrendingTokens] = useState<TokenTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localIsConnected, setLocalIsConnected] = useState(parentIsConnected);
  const [showDisconnectMenu, setShowDisconnectMenu] = useState(false);
  const [lastPrices, setLastPrices] = useState<{[key: string]: number}>({});

  useEffect(() => {
    setLocalIsConnected(parentIsConnected);
  }, [parentIsConnected]);

  const disconnectWallet = () => {
    setLocalIsConnected(false);
    setShowDisconnectMenu(false);
    window.dispatchEvent(new CustomEvent('wallet-disconnected'));
    toast.success('Wallet disconnected');
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      if (!window.ethereum) {
        toast.error('Please install MetaMask to use this application');
        return;
      }

      console.log('Connecting to wallet...');

      // Clear any existing event listeners
      window.ethereum.removeAllListeners?.();

      // Request accounts first
      console.log('Requesting accounts...');
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      }).catch((err: any) => {
        if (err.code === 4001) {
          throw new Error('Please accept the connection request');
        }
        throw err;
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      console.log('Connected account:', accounts[0]);

      // Then check and switch network
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      console.log('Current chain ID:', currentChainId);

      if (currentChainId !== '0xaa36a7') {
        console.log('Switching to Sepolia network...');
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }],
          });
        } catch (switchError: any) {
          console.log('Switch error:', switchError);
          if (switchError.code === 4902) {
            try {
              console.log('Adding Sepolia network...');
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0xaa36a7',
                  chainName: 'Sepolia Test Network',
                  nativeCurrency: {
                    name: 'ETH',
                    symbol: 'ETH',
                    decimals: 18
                  },
                  rpcUrls: ['https://eth-sepolia.g.alchemy.com/v2/JkwlX2jl-1k1wTZQPFHuC-YYuLcoldZk'],
                  blockExplorerUrls: ['https://sepolia.etherscan.io']
                }]
              });
            } catch (addError) {
              console.error('Failed to add Sepolia:', addError);
              throw new Error('Failed to add Sepolia network');
            }
          } else {
            throw new Error('Please switch to Sepolia network');
          }
        }
      }

      // Verify chain ID again after connection
      const chainId = await window.ethereum.request({ 
        method: 'eth_chainId' 
      });
      
      if (chainId !== '0xaa36a7') {
        throw new Error('Please switch to Sepolia network');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Dispatch wallet connected event
      window.dispatchEvent(new CustomEvent('wallet-connected', { 
        detail: { address, chainId } 
      }));

      setLocalIsConnected(true);
      toast.success('Wallet connected successfully!');

      // Set up event listeners for account and chain changes
      window.ethereum.on('accountsChanged', (newAccounts: string[]) => {
        console.log('Accounts changed:', newAccounts);
        if (!newAccounts || newAccounts.length === 0) {
          setLocalIsConnected(false);
          window.dispatchEvent(new CustomEvent('wallet-disconnected'));
          toast.error('Wallet disconnected');
        } else {
          window.dispatchEvent(new CustomEvent('wallet-connected', {
            detail: { address: newAccounts[0], chainId }
          }));
        }
      });

      window.ethereum.on('chainChanged', (newChainId: string) => {
        console.log('Chain changed:', newChainId);
        if (newChainId !== '0xaa36a7') {
          toast.error('Please switch to Sepolia network');
          setLocalIsConnected(false);
          window.dispatchEvent(new CustomEvent('wallet-disconnected'));
        }
        window.location.reload();
      });

      window.ethereum.on('disconnect', () => {
        console.log('Wallet disconnected');
        setLocalIsConnected(false);
        window.dispatchEvent(new CustomEvent('wallet-disconnected'));
        toast.error('Wallet disconnected');
      });

    } catch (err: any) {
      console.error('Connection error:', err);
      let errorMessage = 'Failed to connect wallet';
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.code === 4001) {
        errorMessage = 'Please accept the connection request';
      } else if (err.code === -32002) {
        errorMessage = 'Connection request already pending. Please check MetaMask';
      }
      
      toast.error(errorMessage);
      setLocalIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    const fetchTokenData = async () => {
      try {
        const symbols = SEPOLIA_TOKENS.map(token => token.symbol);
        const prices = await getTokenPrices(symbols);
        
        // Only update loading state if we don't have any prices yet
        if (!trendingTokens.length) {
          setIsLoading(true);
        }
        
        const tokenTrends = SEPOLIA_TOKENS.map(token => {
          const currentPrice = prices[token.symbol] || 0;
          const previousPrice = lastPrices[token.symbol] || currentPrice;
          const priceChange = previousPrice ? ((currentPrice - previousPrice) / previousPrice * 100) : 0;
          
          // Keep previous price if new price is 0 (failed to fetch)
          return {
            token,
            price: currentPrice || (lastPrices[token.symbol] || 0),
            priceChange: !currentPrice ? 0 : priceChange
          };
        });

        setLastPrices(prices);
        setTrendingTokens(tokenTrends);
      } catch (error) {
        console.error('Error fetching token data:', error);
        // Don't show error toast for subsequent failed updates
        if (isLoading) {
          toast.error('Failed to fetch token prices');
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately
    fetchTokenData();
    
    // Then set up interval
    const interval = setInterval(fetchTokenData, 15000);
    return () => clearInterval(interval);
  }, [lastPrices, isLoading]);

  return (
    <nav className="border-b border-gray-800 p-4 backdrop-blur-md bg-black/30">
      <div className="container mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img
              src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMiIgZmlsbD0iIzNiODJmNiIvPjxwYXRoIGQ9Ik04IDhoOHY4SDh6IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg=="
              alt="MonoSwap"
              className="w-8 h-8 rounded-full"
            />
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              MonoSwap
            </h1>
          </div>

          <div className="hidden md:flex items-center space-x-6 overflow-x-auto">
            {isLoading && !trendingTokens.length ? (
              <div className="text-gray-400 animate-pulse">Loading prices...</div>
            ) : (
              trendingTokens.map(({ token, price, priceChange }) => (
                <div key={token.symbol} className="flex items-center space-x-2 min-w-[160px]">
                  <img
                    src={token.logoURI}
                    alt={token.symbol}
                    className="w-6 h-6 rounded-full"
                    onError={(e) => {
                      e.currentTarget.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMiIgZmlsbD0iIzNiODJmNiIvPjwvc3ZnPg==";
                    }}
                  />
                  <div>
                    <div className="font-medium">{token.symbol}</div>
                    <div className={`text-sm ${price ? 'text-gray-400' : 'text-gray-500'}`}>
                      ${price ? price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }) : 'Loading...'}
                    </div>
                  </div>
                  <div className={`text-sm ${
                    !price ? 'text-gray-500' :
                    priceChange >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {price ? (
                      `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`
                    ) : '---'}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="relative">
            {localIsConnected ? (
              <button
                onClick={() => setShowDisconnectMenu(!showDisconnectMenu)}
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold py-2 px-4 rounded-lg hover:opacity-90"
              >
                {formatAddress(parentAccount)}
              </button>
            ) : (
              <button
                data-connect-wallet
                onClick={connectWallet}
                disabled={isConnecting}
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold py-2 px-4 rounded-lg hover:opacity-90"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}

            {showDisconnectMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5">
                <div className="py-1" role="menu" aria-orientation="vertical">
                  <button
                    onClick={disconnectWallet}
                    className="block w-full px-4 py-2 text-sm text-white hover:bg-gray-700"
                    role="menuitem"
                  >
                    Disconnect Wallet
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 