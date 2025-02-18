import { useEffect } from 'react';
import useTransactionStore from '../stores/transactionStore';
import { formatDistanceToNow } from 'date-fns';

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
        <span className="text-sm text-gray-400">Last 10 transactions</span>
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
                  {formatDistanceToNow(tx.timestamp, { addSuffix: true })}
                </div>
              </div>
              <span className={`text-sm font-medium ${getStatusColor(tx.status)}`}>
                {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-gray-400">From: </span>
                <span>
                  {tx.from.amount} {tx.from.symbol}
                </span>
              </div>
              <div>
                <span className="text-gray-400">To: </span>
                <span>
                  {tx.to.amount} {tx.to.symbol}
                </span>
              </div>
            </div>
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