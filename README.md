# 🌸 Nomi: Secure Encrypted On-Chain Diary  
A privacy-first personal diary that combines blockchain immutability with end-to-end client-side encryption.

Nomi demonstrates how sensitive user data can be stored on the blockchain without exposing plaintext to the network, the smart contract, or any external party.  
All diary entries are encrypted locally in the browser using AES-GCM, then stored on-chain as ciphertext through a secure Solidity contract with access control, versioning, delegation, and integrity checks.

This project was developed as a full academic blockchain prototype exploring security, cryptography, smart contracts, and Web3 system design.

---

## 🌟 Project Overview

Traditional blockchains are transparent—everyone can read every stored value.  
Nomi solves this by shifting all encryption to the user’s device:

1. A user writes a diary entry.  
2. Their password is used to derive a cryptographic key using PBKDF2.  
3. The entry is encrypted using AES-GCM with a random IV and salt.  
4. Only the encrypted text (cipherB64 envelope) is sent to Ethereum.  
5. The blockchain stores:  
   - ciphertext  
   - version  
   - timestamp  
   - a `keccak256` integrity hash  
   - soft-delete flags  
6. Users can optionally grant delegates permission to read entries.

This approach keeps the blockchain immutable **without sacrificing confidentiality**.

---

## 🧩 System Architecture

The Nomi project is composed of **three main layers**:

### **1. Smart Contracts (Solidity)**
- `SecureDiary.sol` — the final contract used by the application  
- Includes:
  - encrypted entry storage  
  - delegation system  
  - optimistic versioning  
  - integrity hashing  
  - soft deletion  
  - replay-attack protection  
  - event logging  

This is the main contract powering the system.

- `DigitalDiaryFinal.sol` — **legacy prototype**  
  - Stored simple IPFS CIDs  
  - No delegation, no integrity checks, no versioning  
  - Kept only for documentation and comparison  

---

### **2. Frontend (React + Vite)**
Implements the entire security model:

- Local AES-GCM encryption/decryption  
- PBKDF2 password-based key derivation  
- Entry creation, editing, deletion  
- UI-based delegation management  
- MetaMask interaction  
- Fetching and decrypting entries  
- Dark pastel diary theme (Nomi UI)

All encryption is handled via the WebCrypto API and never leaves the device.

---

### **3. Hardhat Suite**
- Local blockchain simulation  
- Contract testing  
- Deployment scripting  
- Gas and latency measurement  
- Event monitoring  

Included because the project requires performance evaluation and attack analysis.

---

## 🔒 Security Model & Attack Resistance

The project was designed to resist attacks including:

### **Impersonation Attacks**
- Contract checks owner or delegate before returning ciphertext.
- No plaintext or passwords are ever stored.

### **Modification Attacks**
- Updates require the correct version (`expectedVersion`).
- Prevents stale writes, overwrites, or replay attack attempts.

### **Unauthorized Reads**
- Ciphertext is unreadable without the user's AES key.
- Smart contract denies reads unless caller is owner or approved delegate.

### **Replay Attacks**
- Version numbers increment on every update or delete.
- Replaying an old write fails automatically.

### **Integrity Violations**
- `keccak256(ciphertext)` stored for each entry.
- Allows verification that ciphertext hasn’t been tampered with.

---

## ⚙️ Technology Stack

### **Blockchain**
- Solidity ^0.8.19  
- Hardhat (test + deploy)  
- Local Ethereum simulation  

### **Frontend**
- React + Vite  
- AES-GCM encryption  
- PBKDF2 derivation  
- Ethers.js + MetaMask  

### **Cryptography**
- AES-GCM 256-bit  
- PBKDF2 (200,000 iterations)  
- Random salt + IV per entry  
- Base64-encoded ciphertext envelope  

---

## 🧠 Smart Contract Summary

### ✔ Final Contract: `SecureDiary.sol`  
Features:
- Add encrypted entries  
- Update entries securely  
- Soft delete  
- Delegation system  
- Replay protection  
- Integrity hashing  
- Event auditing  

### ✔ Legacy Contract: `DigitalDiaryFinal.sol`  
Purpose:
- Early prototype storing IPFS CIDs  
- No cryptography, no versioning  
- Preserved for comparison  

---

## 🚀 Running the Project

### 1. Clone the repo
git clone https://github.com/rahmaaax/nomi-secure-diary

cd nomi-secure-diary


### 2. Install dependencies


npm install


### 3. Start blockchain (Hardhat)


npx hardhat node


### 4. Deploy contract


npx hardhat run scripts/deploy.js --network localhost


Paste your deployed address into:


frontend/src/App.jsx → CONTRACT_ADDRESS


### 5. Run frontend


npm run dev


Open: **http://localhost:5173**

---

## 📊 Performance Metrics

The app records:

- Gas used when adding entries  
- Latency (ms) between sending and mining transactions  

Required for the project’s performance analysis.

---

## 🧪 Testing

Hardhat tests include:

- Adding entries  
- Updating with expected version  
- Preventing unauthorized reads  
- Delegation and revocation  
- Soft deletion logic  

All tests pass.

---

## 🌸 Project Status

Nomi is a complete working prototype demonstrating:

- Private on-chain diary  
- End-to-end encryption  
- Permission-based sharing  
- Versioning and integrity guarantees  
- Protection against replay, impersonation, and modification attacks  
- Clean diary-style UI

Future work could include:

- Cross-device key sync  
- Zero-knowledge proof-based sharing  
- IPFS hybrid encrypted storage  
- Multi-user collaboration  

---

## 🪪 License
MIT
