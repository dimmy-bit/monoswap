import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy Factory
  const MonoSwapFactory = await ethers.getContractFactory("MonoSwapFactory");
  const factory = await MonoSwapFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("MonoSwapFactory deployed to:", factoryAddress);

  // Deploy Router
  const MonoSwapRouter = await ethers.getContractFactory("MonoSwapRouter");
  const router = await MonoSwapRouter.deploy(factoryAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("MonoSwapRouter deployed to:", routerAddress);

  // Create MONO/USDT pair
  const MONO_TOKEN = "0x92670D1d1753d4e2658108a858D8369b5A50b1b1";
  const USDT_TOKEN = "0xE8499AbC9F8d57F0Be924231D13b70Efa2e118d4";
  
  await factory.createPair(MONO_TOKEN, USDT_TOKEN);
  const pair = await factory.getPair(MONO_TOKEN, USDT_TOKEN);
  console.log("MONO/USDT pair created at:", pair);

  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("Factory:", factoryAddress);
  console.log("Router:", routerAddress);
  console.log("MONO/USDT Pair:", pair);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
