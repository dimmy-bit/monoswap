import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Adding liquidity with account:", deployer.address);

  const ROUTER_ADDRESS = "0xfAFa90f15e0b37b394f6e5e9d35b1dEEE783AF82";
  const USDT_ADDRESS = "0xE8499AbC9F8d57F0Be924231D13b70Efa2e118d4";

  // Get contract instances
  const router = await ethers.getContractAt("MonoSwapRouter", ROUTER_ADDRESS);
  const usdt = await ethers.getContractAt("MonoToken", USDT_ADDRESS);

  // Mint some USDT to the deployer if needed
  const usdtBalance = await usdt.balanceOf(deployer.address);
  if (usdtBalance == 0n) {
    console.log("Minting USDT to deployer...");
    await usdt.mint(deployer.address, ethers.parseEther("10000"));
    console.log("USDT minted");
  }

  // Approve USDT for router
  const usdtAmount = ethers.parseEther("1000"); // 1000 USDT
  console.log("Approving USDT...");
  await usdt.approve(ROUTER_ADDRESS, usdtAmount);
  console.log("USDT approved");

  // Add liquidity ETH/USDT
  console.log("Adding liquidity...");
  const ethAmount = ethers.parseEther("0.1"); // 0.1 ETH
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now

  console.log(`Adding liquidity with:
    USDT Amount: ${ethers.formatEther(usdtAmount)} USDT
    ETH Amount: ${ethers.formatEther(ethAmount)} ETH
    Deadline: ${new Date(deadline * 1000).toLocaleString()}
  `);
  
  const tx = await router.addLiquidityETH(
    USDT_ADDRESS,
    usdtAmount,
    usdtAmount, // min USDT - no slippage for testing
    ethAmount,  // min ETH - no slippage for testing
    deployer.address,
    deadline,
    { value: ethAmount }
  );

  console.log("Transaction sent:", tx.hash);
  await tx.wait();
  console.log("Liquidity added successfully!");

  console.log("\nLiquidity Summary:");
  console.log("-------------------");
  console.log("ETH added:", ethers.formatEther(ethAmount));
  console.log("USDT added:", ethers.formatEther(usdtAmount));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 