import { ethers } from "hardhat";
import { config } from "../config";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying USDT and adding liquidity with account:", deployer.address);

  // Deploy USDT
  console.log("Deploying USDT...");
  const TestToken = await ethers.getContractFactory("MonoToken");
  const usdt = await TestToken.deploy(ethers.parseEther("1000000")); // 1 million tokens
  await usdt.waitForDeployment();
  const USDT_ADDRESS = await usdt.getAddress();
  console.log("USDT deployed to:", USDT_ADDRESS);

  // Get Router instance
  const ROUTER_ADDRESS = config.ROUTER;
  const router = await ethers.getContractAt("MonoSwapRouter", ROUTER_ADDRESS);

  // Approve USDT for router
  const usdtAmount = ethers.parseEther("1000"); // 1000 USDT
  console.log("Approving USDT...");
  const approveTx = await usdt.approve(ROUTER_ADDRESS, usdtAmount);
  console.log("Approval transaction sent:", approveTx.hash);
  await approveTx.wait();
  console.log("USDT approved successfully");

  // Verify allowance
  const allowance = await usdt.allowance(deployer.address, ROUTER_ADDRESS);
  console.log("Router allowance:", ethers.formatEther(allowance), "USDT");

  // Add liquidity ETH/USDT
  console.log("\nAdding liquidity...");
  const ethAmount = ethers.parseEther("0.1"); // 0.1 ETH
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now

  console.log(`Adding liquidity with:
    USDT Amount: ${ethers.formatEther(usdtAmount)} USDT
    ETH Amount: ${ethers.formatEther(ethAmount)} ETH
    Deadline: ${new Date(deadline * 1000).toLocaleString()}
  `);
  
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
  console.log("USDT Token:", USDT_ADDRESS);
  console.log("Router:", ROUTER_ADDRESS);
  console.log("ETH added:", ethers.formatEther(ethAmount));
  console.log("USDT added:", ethers.formatEther(usdtAmount));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 