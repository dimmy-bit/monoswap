const hre = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy MonoFactory
  const MonoFactory = await ethers.getContractFactory("MonoFactory");
  const factory = await MonoFactory.deploy();
  await factory.waitForDeployment();
  console.log("MonoFactory deployed to:", await factory.getAddress());

  // Deploy MonoRouter
  const MonoRouter = await ethers.getContractFactory("MonoRouter");
  const router = await MonoRouter.deploy(await factory.getAddress());
  await router.waitForDeployment();
  console.log("MonoRouter deployed to:", await router.getAddress());

  // Deploy Test Tokens
  const MonoToken = await ethers.getContractFactory("MonoToken");
  
  const token1 = await MonoToken.deploy("Test Token 1", "TT1", ethers.parseEther("1000000"));
  await token1.waitForDeployment();
  console.log("Test Token 1 deployed to:", await token1.getAddress());

  const token2 = await MonoToken.deploy("Test Token 2", "TT2", ethers.parseEther("1000000"));
  await token2.waitForDeployment();
  console.log("Test Token 2 deployed to:", await token2.getAddress());

  console.log("\nDeployment complete! Contract addresses:");
  console.log("======================================");
  console.log("MonoFactory:", await factory.getAddress());
  console.log("MonoRouter:", await router.getAddress());
  console.log("Test Token 1:", await token1.getAddress());
  console.log("Test Token 2:", await token2.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
