import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Router with account:", deployer.address);

  // Deploy WETH first
  console.log("\nDeploying WETH...");
  const WETH = await ethers.getContractFactory("WETH");
  const weth = await WETH.deploy();
  await weth.waitForDeployment();
  const WETH_ADDRESS = await weth.getAddress();
  console.log("WETH deployed to:", WETH_ADDRESS);

  // Deploy Factory
  console.log("\nDeploying Factory...");
  const MonoSwapFactory = await ethers.getContractFactory("MonoSwapFactory");
  const factory = await MonoSwapFactory.deploy();
  await factory.waitForDeployment();
  const FACTORY_ADDRESS = await factory.getAddress();
  console.log("Factory deployed to:", FACTORY_ADDRESS);

  // Deploy Router with new WETH
  console.log("\nDeploying Router...");
  const MonoSwapRouter = await ethers.getContractFactory("MonoSwapRouter");
  const router = await MonoSwapRouter.deploy(FACTORY_ADDRESS, WETH_ADDRESS);
  await router.waitForDeployment();
  const ROUTER_ADDRESS = await router.getAddress();
  console.log("Router deployed to:", ROUTER_ADDRESS);

  // Deploy test token (MONO/USDT)
  console.log("\nDeploying Test Token...");
  const TestToken = await ethers.getContractFactory("MonoToken");
  const testToken = await TestToken.deploy(ethers.parseEther("1000000")); // 1M tokens
  await testToken.waitForDeployment();
  const TOKEN_ADDRESS = await testToken.getAddress();
  console.log("Test Token deployed to:", TOKEN_ADDRESS);

  // Create pair
  console.log("\nCreating WETH/Token pair...");
  const createPairTx = await factory.createPair(WETH_ADDRESS, TOKEN_ADDRESS);
  await createPairTx.wait();
  const pairAddress = await factory.getPair(WETH_ADDRESS, TOKEN_ADDRESS);
  console.log("Pair created at:", pairAddress);

  // Add initial liquidity
  console.log("\nAdding initial liquidity...");
  
  // Approve tokens
  const tokenAmount = ethers.parseEther("1000");
  const approveTx = await testToken.approve(ROUTER_ADDRESS, tokenAmount);
  await approveTx.wait();
  console.log("Token approved for Router");

  // Add liquidity
  const ethAmount = ethers.parseEther("0.1");
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

  const addLiquidityTx = await router.addLiquidityETH(
    TOKEN_ADDRESS,
    tokenAmount,
    tokenAmount,
    ethAmount,
    deployer.address,
    deadline,
    { value: ethAmount }
  );
  await addLiquidityTx.wait();
  console.log("Initial liquidity added");

  // Get and log reserves
  const pair = await ethers.getContractAt("MonoSwapPair", pairAddress);
  const reserves = await pair.getReserves();
  console.log("\nInitial reserves:");
  console.log("Reserve0:", ethers.formatEther(reserves[0]));
  console.log("Reserve1:", ethers.formatEther(reserves[1]));

  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("WETH:", WETH_ADDRESS);
  console.log("Factory:", FACTORY_ADDRESS);
  console.log("Router:", ROUTER_ADDRESS);
  console.log("Test Token:", TOKEN_ADDRESS);
  console.log("Pair:", pairAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 