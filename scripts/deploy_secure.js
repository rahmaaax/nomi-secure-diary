// scripts/deploy_secure.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const Factory = await hre.ethers.getContractFactory("SecureDiary");
  const contract = await Factory.deploy();
  await contract.deployed();

  console.log("SecureDiary deployed to:", contract.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
