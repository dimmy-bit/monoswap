import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying test tokens with account:", deployer.address);

  // Deploy Test USDT
  const TestToken = await ethers.getContractFactory("MonoToken");
  const testUSDT = await TestToken.deploy(ethers.parseEther("1000000")); // 1 million tokens
  await testUSDT.waitForDeployment();
  console.log("Test USDT deployed to:", await testUSDT.getAddress());

  // Create pair with MONO token
  const MonoFactory = await ethers.getContractFactory("MonoSwapFactory");
  const factory = MonoFactory.attach("0x92670D1d1753d4e2658108a858D8369b5A50b1b1");
  
  const MONO_TOKEN = "0x92670D1d1753d4e2658108a858D8369b5A50b1b1";
  
  // Create MONO/USDT pair
  await factory.createPair(MONO_TOKEN, await testUSDT.getAddress());
  const pair = await factory.getPair(MONO_TOKEN, await testUSDT.getAddress());
  console.log("MONO/USDT pair created at:", pair);

  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("Test USDT:", await testUSDT.getAddress());
  console.log("MONO/USDT Pair:", pair);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 