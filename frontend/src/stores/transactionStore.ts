import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Transaction, TransactionStore } from '../types/transaction';

const useTransactionStore = create<TransactionStore>()(
  persist(
    (set) => ({
      transactions: [],
      addTransaction: (tx: Transaction) =>
        set((state) => ({
          transactions: [{
            ...tx,
            timestamp: tx.timestamp || Date.now()
          }, ...state.transactions].slice(0, 10), // Keep only last 10 transactions
        })),
      updateTransaction: (hash: string, updates: Partial<Transaction>) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.hash === hash ? { ...tx, ...updates } : tx
          ),
        })),
      clearTransactions: () => set({ transactions: [] }),
    }),
    {
      name: 'transaction-store',
    }
  )
);

export default useTransactionStore; 