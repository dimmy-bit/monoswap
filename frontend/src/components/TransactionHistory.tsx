import { useEffect } from 'react';
import useTransactionStore from '../stores/transactionStore';
import { formatDistanceToNowStrict } from 'date-fns';
import { ethers } from 'ethers';

export default function TransactionHistory() {
  const { transactions } = useTransactionStore();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-yellow-500';
    }
  };

  const formatTime = (timestamp: number) => {
    try {
      return formatDistanceToNowStrict(timestamp, { addSuffix: true });
    } catch (error) {
      return 'just now';
    }
  };

  const formatAmount = (amount: string, symbol: string) => {
    try {
      // Handle ETH and other tokens differently
      if (symbol === 'ETH' || symbol === 'WETH') {
        const ethAmount = ethers.formatEther(amount);
        return parseFloat(ethAmount).toLocaleString(undefined, {
          minimumFractionDigits: 4,
          maximumFractionDigits: 8
        });
      } else {
        // For USDT and USDC (6 decimals)
        const value = symbol === 'USDT' || symbol === 'USDC' 
          ? parseFloat(amount) / 1e6
          : parseFloat(amount);
        
        return value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6
        });
      }
    } catch (error) {
      console.error('Error formatting amount:', error, { amount, symbol });
      return '0.00';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'SWAP':
        return 'Swap';
      case 'ADD_LIQUIDITY':
        return 'Add Liquidity';
      case 'REMOVE_LIQUIDITY':
        return 'Remove Liquidity';
      default:
        return type;
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="mt-8 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Transaction History</h2>
        <p className="text-gray-400 text-center">No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="mt-8 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Transaction History</h2>
        <span className="text-sm text-gray-400">Last {transactions.length} transactions</span>
      </div>
      <div className="space-y-4">
        {transactions.map((tx) => (
          <div
            key={tx.hash}
            className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-gray-500 transition-all"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-sm font-medium">{getTransactionTypeLabel(tx.type)}</span>
                <div className="text-sm text-gray-400 mt-1">
                  {formatTime(tx.timestamp)}
                </div>
              </div>
              <span className={`text-sm font-medium ${getStatusColor(tx.status)}`}>
                {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-gray-400">From: </span>
                <span className="font-medium">
                  {formatAmount(tx.from.amount, tx.from.symbol)} {tx.from.symbol}
                </span>
              </div>
              <div>
                <span className="text-gray-400">To: </span>
                <span className="font-medium">
                  {formatAmount(tx.to.amount, tx.to.symbol)} {tx.to.symbol}
                </span>
              </div>
            </div>
            {tx.status === 'completed' && (
              <div className="mt-2 text-xs text-gray-400">
                Rate: 1 {tx.from.symbol} = {(() => {
                  try {
                    // Handle different token decimal cases
                    let fromAmount = tx.from.amount;
                    let toAmount = tx.to.amount;
                    
                    // Convert amounts based on token type
                    if (tx.from.symbol === 'ETH' || tx.from.symbol === 'WETH') {
                      fromAmount = ethers.formatEther(fromAmount);
                    } else if (tx.from.symbol === 'USDT' || tx.from.symbol === 'USDC') {
                      fromAmount = (Number(fromAmount) / 1e6).toString();
                    }
                    
                    if (tx.to.symbol === 'ETH' || tx.to.symbol === 'WETH') {
                      toAmount = ethers.formatEther(toAmount);
                    } else if (tx.to.symbol === 'USDT' || tx.to.symbol === 'USDC') {
                      toAmount = (Number(toAmount) / 1e6).toString();
                    }
                    
                    // Calculate rate
                    const rate = Number(toAmount) / Number(fromAmount);
                    
                    // Format the rate
                    return rate.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6
                    });
                  } catch (error) {
                    console.error('Error calculating rate:', error);
                    return '0.00';
                  }
                })()} {tx.to.symbol}
              </div>
            )}
            <div className="mt-2">
              <a
                href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                View on Etherscan ↗
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 