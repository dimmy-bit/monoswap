# MonoSwap DEX

A decentralized exchange (DEX) built on the Sepolia testnet, allowing users to swap ETH and various ERC20 tokens.

🌐 **Live Website**: [https://monoswap-git-main-dimmy-bits-projects.vercel.app/](https://monoswap-git-main-dimmy-bits-projects.vercel.app/)

## Features

- Swap ETH to Token
- Swap Token to ETH
- Swap Token to Token
- Real-time price charts
- Transaction history
- MetaMask integration
- Support for multiple tokens (ETH, MONO, USDT, USDC, LINK)

## Prerequisites

- Node.js 16+ and npm
- MetaMask wallet
- Sepolia testnet ETH

## Getting Started

1. Clone the repository:
```bash
git clone <your-repo-url>
cd monoswap
```

2. Install dependencies:
```bash
cd frontend
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the frontend directory with the following variables:
```env
NEXT_PUBLIC_CRYPTOCOMPARE_API_KEY=your_api_key
NEXT_PUBLIC_ALCHEMY_API_KEY=your_api_key
NEXT_PUBLIC_SEPOLIA_RPC_URL=your_rpc_url
NEXT_PUBLIC_FACTORY_ADDRESS=your_factory_address
NEXT_PUBLIC_ROUTER_ADDRESS=your_router_address
NEXT_PUBLIC_WETH_ADDRESS=your_weth_address
NEXT_PUBLIC_MONO_TOKEN_ADDRESS=your_mono_address
NEXT_PUBLIC_CHAIN_ID=11155111
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Smart Contracts

All smart contracts are deployed on the Sepolia testnet:

- Factory: `0x6f9DCBC043944a1030202936B90E3F71871d5Be9`
- Router: `0x3D924222C88810FD1B723Ca853eb3ED77c62CCCf`
- WETH: `0x49ABcb37bad7787178eE82d57aca11c849AfAA78`
- MONO Token: `0x24776FD1315302B7B7DDA793e4c08A21b86450D0`

## Usage

1. Connect your MetaMask wallet
2. Select tokens to swap
3. Enter amount
4. Click "Swap"
5. Confirm the transaction in MetaMask

## Development

- Frontend: Next.js, TypeScript, Tailwind CSS
- Smart Contracts: Solidity, Hardhat
- Web3 Integration: ethers.js

## Deployment

The application is deployed on Vercel. To deploy your own instance:

1. Push your code to GitHub
2. Import the repository in Vercel
3. Set up environment variables in Vercel dashboard
4. Deploy

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
