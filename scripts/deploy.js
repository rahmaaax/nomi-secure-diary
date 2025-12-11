
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const ContractName = "DigitalDiaryFinal"; // make sure this matches the contract name inside the .sol file

  const Factory = await hre.ethers.getContractFactory(ContractName);
  const contract = await Factory.deploy();
  await contract.deployed();

  console.log(`${ContractName} deployed to:`, contract.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
