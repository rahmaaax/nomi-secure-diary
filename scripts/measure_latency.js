const hre = require("hardhat");
const { performance } = require("perf_hooks");

async function main() {
  const [user] = await hre.ethers.getSigners();

  const Diary = await hre.ethers.getContractFactory("SecureDiary");
  const diary = await Diary.deploy();
  await diary.deployed();

  console.log("Contract deployed at:", diary.address);

  const cipher = "bG9yZW0gaXBzdW0gZG9sb3I="; // dummy encrypted text

  console.log("\n=== LATENCY TEST ===");

  const start = performance.now();

  const tx = await diary.addEntry(cipher);
  await tx.wait(); // confirmation

  const end = performance.now();

  const latencyMs = end - start;

  console.log("Transaction confirmation latency:", latencyMs.toFixed(2), "ms");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
