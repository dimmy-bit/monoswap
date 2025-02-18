import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy WETH
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
  console.log("MonoSwapFactory deployed to:", FACTORY_ADDRESS);

  // Deploy Router
  console.log("\nDeploying Router...");
  const MonoSwapRouter = await ethers.getContractFactory("MonoSwapRouter");
  const router = await MonoSwapRouter.deploy(FACTORY_ADDRESS, WETH_ADDRESS);
  await router.waitForDeployment();
  const ROUTER_ADDRESS = await router.getAddress();
  console.log("MonoSwapRouter deployed to:", ROUTER_ADDRESS);

  // Deploy USDT
  console.log("\nDeploying USDT...");
  const TestToken = await ethers.getContractFactory("MonoToken");
  const usdt = await TestToken.deploy(ethers.parseEther("1000000")); // 1 million tokens
  await usdt.waitForDeployment();
  const USDT_ADDRESS = await usdt.getAddress();
  console.log("USDT deployed to:", USDT_ADDRESS);

  // Create pair first
  console.log("\nCreating USDT/WETH pair...");
  const createPairTx = await factory.createPair(USDT_ADDRESS, WETH_ADDRESS);
  await createPairTx.wait();
  const pairAddress = await factory.getPair(USDT_ADDRESS, WETH_ADDRESS);
  console.log("Pair created at:", pairAddress);

  // Approve USDT for router with a very large allowance
  const usdtAmount = ethers.parseEther("1000"); // 1000 USDT
  const maxApproval = ethers.MaxUint256; // Maximum possible approval
  console.log("\nApproving USDT for Router...");
  const routerApproveTx = await usdt.approve(ROUTER_ADDRESS, maxApproval);
  console.log("Router approval transaction sent:", routerApproveTx.hash);
  await routerApproveTx.wait();
  console.log("USDT approved for Router");

  // Verify USDT allowance for router
  const routerAllowance = await usdt.allowance(deployer.address, ROUTER_ADDRESS);
  console.log("Router USDT allowance:", ethers.formatEther(routerAllowance), "USDT");

  // Add liquidity ETH/USDT
  console.log("\nAdding liquidity...");
  const ethAmount = ethers.parseEther("0.1"); // 0.1 ETH
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now

  console.log(`Adding liquidity with:
    USDT Amount: ${ethers.formatEther(usdtAmount)} USDT
    ETH Amount: ${ethers.formatEther(ethAmount)} ETH
    Deadline: ${new Date(deadline * 1000).toLocaleString()}
  `);

  // Add liquidity
  const tx = await router.addLiquidityETH(
    USDT_ADDRESS,
    usdtAmount,        // amountTokenDesired
    usdtAmount,        // amountTokenMin - no slippage for testing
    ethAmount,         // amountETHMin - no slippage for testing
    deployer.address,   // to
    deadline,          // deadline
    { value: ethAmount }
  );

  console.log("Transaction sent:", tx.hash);
  await tx.wait();
  console.log("Liquidity added successfully!");

  console.log("\nDeployment & Liquidity Summary:");
  console.log("-------------------");
  console.log("WETH:", WETH_ADDRESS);
  console.log("Factory:", FACTORY_ADDRESS);
  console.log("Router:", ROUTER_ADDRESS);
  console.log("USDT:", USDT_ADDRESS);
  console.log("USDT/WETH Pair:", pairAddress);
  console.log("ETH added:", ethers.formatEther(ethAmount));
  console.log("USDT added:", ethers.formatEther(usdtAmount));

  // Update config.ts
  console.log("\nUpdating config.ts...");
  const configContent = `export const config = {
    MONO_TOKEN: "${USDT_ADDRESS}",
    FACTORY: "${FACTORY_ADDRESS}",
    ROUTER: "${ROUTER_ADDRESS}",
    WETH: "${WETH_ADDRESS}",
    USDT: "${USDT_ADDRESS}"
}`;

  const fs = require("fs");
  fs.writeFileSync("config.ts", configContent);
  console.log("Config updated successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 