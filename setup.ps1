# Frontend setup
cd frontend
npm install
npm install ethers@^6.7.0 @headlessui/react @heroicons/react recharts axios web3 @tailwindcss/forms
npm install -D typescript @types/react @types/node @types/react-dom tailwindcss postcss autoprefixer
cd ..

# Install hardhat and related dependencies
cd contracts
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts
npm install @nomiclabs/hardhat-ethers ethers
cd ..

Write-Host "Setup completed! You can now run the following commands:"
Write-Host "1. cd frontend && npm run dev     (to start the frontend)"
Write-Host "2. cd contracts && npx hardhat node     (to start local blockchain)"
Write-Host "3. cd contracts && npx hardhat run scripts/deploy.ts --network sepolia     (to deploy contracts)" 