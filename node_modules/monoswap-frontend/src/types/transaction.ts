export type TransactionType = 'SWAP' | 'ADD_LIQUIDITY' | 'REMOVE_LIQUIDITY';

export interface Transaction {
  hash: string;
  type: TransactionType;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  from: {
    symbol: string;
    amount: string;
  };
  to: {
    symbol: string;
    amount: string;
  };
}

export interface TransactionStore {
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (hash: string, updates: Partial<Transaction>) => void;
  clearTransactions: () => void;
} 