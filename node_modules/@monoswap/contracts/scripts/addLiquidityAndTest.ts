import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Contract addresses (replace with your deployed contract addresses)
  const ROUTER_ADDRESS = "0x3D924222C88810FD1B723Ca853eb3ED77c62CCCf";
  const USDC_ADDRESS = "0x1c96CFd6AdeC7375B7F0B8F5A8853Ad3a907269d";
  const WETH_ADDRESS = "0x49ABcb37bad7787178eE82d57aca11c849AfAA78";

  // Get contract instances
  const router = await ethers.getContractAt("MonoSwapRouter", ROUTER_ADDRESS);
  const usdc = await ethers.getContractAt("MonoToken", USDC_ADDRESS);

  console.log("\nStep 1: Adding initial liquidity...");
  
  // Amount of tokens to add as liquidity
  const tokenAmount = ethers.parseEther("1000"); // 1000 USDC
  const ethAmount = ethers.parseEther("0.1"); // 0.1 ETH
  
  try {
    // Approve USDC for router
    console.log("Approving USDC...");
    const approveTx = await usdc.approve(ROUTER_ADDRESS, tokenAmount);
    await approveTx.wait();
    console.log("USDC approved");

    // Add liquidity
    console.log("\nAdding liquidity...");
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now
    
    const addLiquidityTx = await router.addLiquidityETH(
      USDC_ADDRESS,
      tokenAmount,
      tokenAmount,
      ethAmount,
      deployer.address,
      deadline,
      { value: ethAmount }
    );
    
    console.log("Waiting for transaction confirmation...");
    await addLiquidityTx.wait();
    console.log("Liquidity added successfully!");

    // Test swap
    console.log("\nStep 2: Testing swap...");
    const swapAmount = ethers.parseEther("0.01"); // Swap 0.01 ETH
    const path = [WETH_ADDRESS, USDC_ADDRESS];
    
    console.log(`Swapping ${ethers.formatEther(swapAmount)} ETH for USDC...`);
    const swapTx = await router.swapExactETHForTokens(
      0, // Accept any amount of USDC
      path,
      deployer.address,
      deadline,
      { value: swapAmount }
    );
    
    await swapTx.wait();
    console.log("Swap successful!");

  } catch (error: any) {
    console.error("Error:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 