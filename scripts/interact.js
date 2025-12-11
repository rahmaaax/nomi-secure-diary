// scripts/interact.js
const hre = require("hardhat");

async function main() {
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // deployed address

  const [owner, other] = await hre.ethers.getSigners();
  console.log("Using deployer:", owner.address);

  const diary = await hre.ethers.getContractAt("DigitalDiaryFinal", contractAddress);

  // show current count
  let count = (await diary.entryCount(owner.address)).toNumber();
  console.log("Before, entryCount:", count);

  // add an entry (example CID)
  const sampleCid = "bafybeiexamplecid1";
  const tx = await diary.addEntry(sampleCid);
  await tx.wait();
  console.log("Added entry:", sampleCid);

  // read back
  count = (await diary.entryCount(owner.address)).toNumber();
  console.log("After, entryCount:", count);

  const e0 = await diary.getEntry(owner.address, 0);
  console.log("Entry[0]:", e0);

  const all = await diary.getAllEntries(owner.address);
  console.log("All entries:", all);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
