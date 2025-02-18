import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Adding liquidity with account:", deployer.address);

  // Contract addresses
  const ROUTER_ADDRESS = "0x3D924222C88810FD1B723Ca853eb3ED77c62CCCf";
  const MONO_ADDRESS = "0x24776FD1315302B7B7DDA793e4c08A21b86450D0";
  const FACTORY_ADDRESS = "0x6f9DCBC043944a1030202936B90E3F71871d5Be9";
  const WETH_ADDRESS = "0x49ABcb37bad7787178eE82d57aca11c849AfAA78";

  // Get contract instances
  const router = await ethers.getContractAt("MonoSwapRouter", ROUTER_ADDRESS);
  const factory = await ethers.getContractAt("MonoSwapFactory", FACTORY_ADDRESS);
  const mono = await ethers.getContractAt("MonoToken", MONO_ADDRESS);

  // Check if pair exists
  console.log("\nChecking pair existence...");
  const pairAddress = await factory.getPair(WETH_ADDRESS, MONO_ADDRESS);
  console.log("Pair address:", pairAddress);

  if (pairAddress === "0x0000000000000000000000000000000000000000") {
    console.log("Creating new pair...");
    await factory.createPair(WETH_ADDRESS, MONO_ADDRESS);
    console.log("Pair created");
  }

  // Get pair contract
  const pair = await ethers.getContractAt("MonoSwapPair", pairAddress);
  
  // Check current reserves
  const reserves = await pair.getReserves();
  console.log("\nCurrent reserves:");
  console.log("Reserve0:", ethers.formatEther(reserves[0]));
  console.log("Reserve1:", ethers.formatEther(reserves[1]));

  // Add more liquidity
  console.log("\nAdding more liquidity...");

  // Approve MONO tokens
  const monoAmount = ethers.parseEther("1000"); // 1000 MONO tokens
  console.log("Approving MONO tokens...");
  await mono.approve(ROUTER_ADDRESS, monoAmount);
  console.log("MONO tokens approved");

  // Add liquidity ETH/MONO
  const ethAmount = ethers.parseEther("0.1"); // 0.1 ETH
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

  console.log(`Adding liquidity:
    MONO Amount: ${ethers.formatEther(monoAmount)} MONO
    ETH Amount: ${ethers.formatEther(ethAmount)} ETH
    Deadline: ${new Date(deadline * 1000).toLocaleString()}
  `);

  const tx = await router.addLiquidityETH(
    MONO_ADDRESS,
    monoAmount,
    monoAmount,
    ethAmount,
    deployer.address,
    deadline,
    { value: ethAmount }
  );

  console.log("Transaction sent:", tx.hash);
  await tx.wait();
  console.log("Liquidity added successfully!");

  // Check new reserves
  const newReserves = await pair.getReserves();
  console.log("\nNew reserves:");
  console.log("Reserve0:", ethers.formatEther(newReserves[0]));
  console.log("Reserve1:", ethers.formatEther(newReserves[1]));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 