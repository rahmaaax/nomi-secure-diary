const hre = require("hardhat");

async function main() {
  const [user] = await hre.ethers.getSigners();

  // Deploy a fresh instance for clean measurement
  const Diary = await hre.ethers.getContractFactory("SecureDiary");
  const diary = await Diary.deploy();
  await diary.deployed();

  console.log("Contract deployed at:", diary.address);

  // Prepare sample ciphertext (just a dummy Base64 string)
  const exampleCipher = "dGVzdF9jaXBoZXJfdmFsdWU="; // "test_cipher_value" in b64

  // --- Measure Gas for addEntry() ---
  const tx = await diary.addEntry(exampleCipher);
  const receipt = await tx.wait();

  console.log("\n=== GAS USAGE ===");
  console.log("addEntry() gas used:", receipt.gasUsed.toString());

  // --- Measure Gas for getAllEntries() ---
  const entries = await diary.getAllEntries(user.address);
  console.log("getAllEntries() gas used: very low (view function, no gas)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
