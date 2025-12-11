// scripts/deploy_node.js
// Deploy using plain ethers + compiled artifact (works around HRE issues)

import fs from "fs";
import path from "path";
import { ethers } from "ethers";

async function main() {
  // connect to your local hardhat node
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // use signer 0 (the first account exposed by hardhat node)
  const signer = provider.getSigner(0);

  // load the compiled artifact (adjust path if different)
  const artifactPath = path.resolve(
    "./artifacts/contracts/DigitalDiaryFinal.sol/DigitalDiaryFinal.json"
  );
  if (!fs.existsSync(artifactPath)) {
    console.error("Artifact not found at", artifactPath);
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // create factory and deploy
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  console.log("Deploying contract, this may take a few seconds...");
  const contract = await factory.deploy();

  // wait for deployment (works with ethers v6 and v5 fallback)
  if (typeof contract.waitForDeployment === "function") {
    await contract.waitForDeployment();
  } else if (typeof contract.deployed === "function") {
    await contract.deployed();
  } else {
    // fallback: wait for 1 confirmation
    await provider.waitForTransaction(contract.deployTransaction.hash, 1);
  }

  // print address
  console.log("DigitalDiaryFinal deployed to:", contract.address ?? contract.target ?? "UNKNOWN");
}

main().catch((err) => {
  console.error("Deployment error:");
  console.error(err);
  process.exit(1);
});
