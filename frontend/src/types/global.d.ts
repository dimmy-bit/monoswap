interface Window {
  ethereum?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    on: (eventName: string, callback: (params: any) => void) => void;
    removeListener: (eventName: string, callback: (params: any) => void) => void;
    selectedAddress: string | null;
    isMetaMask?: boolean;
    chainId?: string;
  };
}

interface Token {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  logoURI?: string;
}

interface TokenBalance {
  token: Token;
  balance: string;
  formattedBalance: string;
} 