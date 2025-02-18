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
    address: CONTRACT_ADDRESSES.MONO_TOKEN,
    symbol: "USDT",
    name: "Tether USD (Sepolia)",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/325/small/Tether.png"
  },
  {
    address: "0x1c96CFd6AdeC7375B7F0B8F5A8853Ad3a907269d",
    symbol: "USDC",
    name: "USD Coin (Sepolia)",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png"
  },
  {
    address: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    symbol: "LINK",
    name: "Chainlink Token (Sepolia)",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png"
  }
]; 