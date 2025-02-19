import { CONTRACT_ADDRESSES } from './contracts';

export const SEPOLIA_TOKENS: Token[] = [
  {
    address: "0x0000000000000000000000000000000000000000",
    symbol: "ETH",
    name: "Sepolia Ether",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png"
  },
  {
    address: CONTRACT_ADDRESSES.USDT,
    symbol: "USDT",
    name: "Tether USD (Sepolia)",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/325/small/Tether.png"
  },
  {
    address: CONTRACT_ADDRESSES.USDC,
    symbol: "USDC",
    name: "USD Coin (Sepolia)",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png"
  },
  {
    address: CONTRACT_ADDRESSES.LINK,
    symbol: "LINK",
    name: "Chainlink Token (Sepolia)",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png"
  }
]; 