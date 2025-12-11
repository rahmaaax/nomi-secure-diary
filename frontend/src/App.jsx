import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { generateKeyFromPassword, encryptText, decryptText } from "./crypto-utils";
import diaryAbi from "./SecureDiaryABI.json";

import "./App.css";
import cuteDiaryImg from "./assets/cute-diary.png";
import whiteLock from "./assets/white-lock.svg";

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // <--- update after deploy

export default function App() {
  // Blockchain state
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState(null);
  const [contract, setContract] = useState(null);

  // Diary password
  const [password, setPassword] = useState("");
  const [derivedKey, setDerivedKey] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Entries
  const [entryText, setEntryText] = useState("");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  // Performance metrics
  const [showPerf, setShowPerf] = useState(false);
  const [lastGas, setLastGas] = useState(null);
  const [lastLatency, setLastLatency] = useState(null);

  // Decrypt modal
  const [activeEntry, setActiveEntry] = useState(null);
  // On-chain modal state
const [onChainEntry, setOnChainEntry] = useState(null);


  /* ============================
        METAMASK DETECTION
  ============================ */
  useEffect(() => {
    if (window.ethereum) {
      const p = new ethers.providers.Web3Provider(window.ethereum, "any");
      setProvider(p);
    }
  }, []);

  /* ============================
        CONNECT WALLET
  ============================ */
  async function connectWallet() {
    if (!provider) {
      alert("No wallet found");
      return;
    }

    try {
      await provider.send("eth_requestAccounts", []);
      const s = provider.getSigner();
      setSigner(s);

      const addr = await s.getAddress();
      setAddress(addr);

      const c = new ethers.Contract(CONTRACT_ADDRESS, diaryAbi, s);
      setContract(c);

      // Auto-refresh when this user adds an entry (EntryAdded event)
      c.on?.("EntryAdded", (owner, index, timestamp, version, hash) => {
        if (owner && addr && owner.toLowerCase() === addr.toLowerCase()) {
          fetchEntries().catch(console.error);
        }
      });
    } catch (err) {
      console.error(err);
      alert("Failed to connect wallet");
    }
  }

  /* ============================
            AUTHENTICATION
  ============================ */
  async function handleUnlock() {
    if (!password.trim()) return alert("Enter a password");

    try {
      const dk = await generateKeyFromPassword(password);
      setDerivedKey(dk);
      setIsUnlocked(true);
      if (contract && address) {
        await fetchEntries();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to derive key");
    }
  }

  function handleLockClear() {
    setPassword("");
    setDerivedKey(null);
    setIsUnlocked(false);
    setActiveEntry(null);
  }

  /* ============================
            ADD ENTRY
  ============================ */
  async function handleAddEntry() {
    if (!contract) return alert("Connect wallet");
    if (!isUnlocked || !derivedKey) return alert("Unlock diary first");
    if (!entryText.trim()) return alert("Write something!");

    setLoading(true);

    try {
      const cipher = await encryptText(derivedKey, entryText.trim());

      const start = Date.now();
      const tx = await contract.addEntry(cipher);
      const receipt = await tx.wait();
      const end = Date.now();

      setLastGas(receipt.gasUsed.toString());
      setLastLatency((end - start).toString());

      setEntryText("");
      await fetchEntries();
    } catch (err) {
      console.error(err);
      alert("Failed to add entry");
    } finally {
      setLoading(false);
    }
  }

  /* ============================
            FETCH ENTRIES
     uses new getAllEntries(owner)
     returns: [ciphers, times, versions, hashes]
  ============================ */
  async function fetchEntries() {
    if (!contract || !address) return;

    setLoading(true);
    try {
      const res = await contract.getAllEntries(address);
      const ciphers = res[0] || [];
      const times = res[1] || [];
      const versions = res[2] || [];
      const hashes = res[3] || [];

      const list = ciphers.map((c, idx) => ({
        index: idx,
        cipherB64: c,
        timestamp: times[idx] ? new Date(times[idx].toNumber() * 1000) : new Date(),
        version: versions[idx] ? versions[idx].toNumber() : 0,
        hash: hashes[idx],
      }));

      // newest first
      setEntries(list.reverse());
    } catch (err) {
      console.error("fetchEntries err", err);
      alert("Failed to fetch entries");
    } finally {
      setLoading(false);
    }
  }

  /* ============================
        DECRYPT ENTRY -> MODAL
  ============================ */
  async function handleDecrypt(entry) {
    if (!isUnlocked || !derivedKey) return alert("Unlock diary first");
    if (!entry || !entry.cipherB64) return alert("No cipher");

    try {
      const plain = await decryptText(derivedKey, entry.cipherB64);
      setActiveEntry({ ...entry, plainText: plain });
    } catch (err) {
      console.error(err);
      alert("Failed to decrypt (wrong password?)");
    }
  }

  function closeModal() {
    setActiveEntry(null);
  }

  /* ============================
        UPDATE / DELETE / DELEGATION
  ============================ */
  async function handleUpdate(entry, newPlain) {
    if (!contract) return alert("Connect wallet");
    if (!entry) return;
    if (!newPlain || !newPlain.trim()) return alert("Enter new text");

    try {
      const cipher = await encryptText(derivedKey, newPlain.trim());
      const expectedVersion = entry.version;
      const tx = await contract.updateEntry(entry.index, cipher, expectedVersion);
      await tx.wait();
      alert("Updated on-chain (encrypted).");
      await fetchEntries();
    } catch (err) {
      console.error("update err", err);
      if (err && err.error && err.error.message) {
        alert("Update failed: " + err.error.message);
      } else {
        alert("Update failed (check version or permissions).");
      }
    }
  }

  async function handleDelete(entry) {
    if (!contract) return alert("Connect wallet");
    if (!entry) return;

    try {
      const tx = await contract.deleteEntry(entry.index);
      await tx.wait();
      alert("Entry soft-deleted on-chain.");
      await fetchEntries();
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  }

  async function handleGrant(entry, delegateAddr) {
    if (!contract) return alert("Connect wallet");
    if (!entry) return;
    if (!delegateAddr) return alert("Enter delegate address");

    try {
      const tx = await contract.grantDelegate(entry.index, delegateAddr);
      await tx.wait();
      alert("Delegate granted");
      await fetchEntries();
    } catch (err) {
      console.error(err);
      alert("Grant failed");
    }
  }

  async function handleRevoke(entry, delegateAddr) {
    if (!contract) return alert("Connect wallet");
    if (!entry) return;
    if (!delegateAddr) return alert("Enter delegate address");

    try {
      const tx = await contract.revokeDelegate(entry.index, delegateAddr);
      await tx.wait();
      alert("Delegate revoked");
      await fetchEntries();
    } catch (err) {
      console.error(err);
      alert("Revoke failed");
    }
  }

  /* ============================
        VIEW SINGLE ENTRY ON-CHAIN
        */

  async function viewOnChain(entry) {
    if (!contract) return alert("Connect");
    try {
      const res = await contract.getEntry(address, entry.index);
      // (cipherB64, timestamp, version, hash, deleted)
      const cipher = res[0];
      const ts = res[1] ? new Date(res[1].toNumber() * 1000) : null;
      const version = res[2] ? res[2].toNumber() : null;
      const hash = res[3];
      const deleted = res[4];

      // Instead of alert -> open styled modal
      setOnChainEntry({
        index: entry.index,
        cipher,
        timestamp: ts,
        version,
        hash,
        deleted,
      });
    } catch (err) {
      console.error(err);
      alert("Failed to read entry on-chain (permission or index)");
    }
  }


  /* ============================
                UI
  ============================ */
  return (
    <div className="app-root">
      <div className="app-shell">
        {/* HEADER */}
        <header className="diary-header">
          <div className="diary-title">
            <div className="diary-logo">
              <img src={whiteLock} alt="Diary Lock" className="logo-lock" />
            </div>

            <div>
              <div className="diary-heading">Nomi: Pink Secure Diary</div>
              <div className="diary-subheading">
                Encrypted on your device, stored safely on-chain.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              className="btn-secondary"
              style={{ fontSize: "0.75rem", padding: "6px 10px" }}
              onClick={() => setShowPerf(!showPerf)}
            >
              {showPerf ? "Hide Metrics" : "Show Metrics"}
            </button>

            <div className="wallet-pill">
              {address ? (
                <>
                  <div className="wallet-dot"></div>
                  <span className="wallet-connected-label">Connected</span>
                </>
              ) : (
                <>
                  <div className="wallet-dot wallet-dot--disconnected"></div>
                  <button className="wallet-button" onClick={connectWallet}>
                    Connect wallet
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* PERFORMANCE PANEL */}
        {showPerf && (
          <div className="diary-card" style={{ marginBottom: "14px" }}>
            <h3 className="entries-title">Performance Metrics</h3>

            {!lastGas ? (
              <p className="status-text">
                Save an entry to record gas usage & latency.
              </p>
            ) : (
              <div style={{ marginTop: "10px" }}>
                <div>
                  <strong>Gas:</strong> {lastGas}
                </div>
                <div>
                  <strong>Latency:</strong> {lastLatency} ms
                </div>
              </div>
            )}
          </div>
        )}

        {/* MAIN AREA */}
        <div className="diary-main">
          {/* LEFT SIDE */}
          <section className="diary-card">
            {!isUnlocked ? (
              <>
                <div className="auth-badge">Locked</div>

                <div className="field-label">
                  Enter diary password <span>(local only)</span>
                </div>

                <input
                  type="password"
                  className="diary-input"
                  placeholder="Your secret key"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <div className="button-row">
                  <button className="btn-primary" onClick={handleUnlock}>
                    Unlock Diary
                  </button>
                </div>

                <div className="status-text">
                  Your password never leaves your device.
                </div>
              </>
            ) : (
              <>
                <div className="field-label">Write a new entry</div>

                <textarea
                  className="diary-textarea"
                  rows={8}
                  placeholder="Write your private thoughts..."
                  value={entryText}
                  onChange={(e) => setEntryText(e.target.value)}
                />

                <div className="button-row">
                  <button
                    className="btn-primary"
                    onClick={handleAddEntry}
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Encrypt & Save"}
                  </button>

                </div>
              </>
            )}
          </section>

          {/* RIGHT SIDE — ENTRIES */}
          <section className="diary-card diary-card--soft">
            <div className="entries-header">
              <div className="entries-title">Your entries</div>
              <div className="entries-count-pill">{entries.length}</div>
            </div>

            <div className="entries-scroll">
              {/* Locked illustration */}
              {!isUnlocked ? (
                <div className="entries-locked-illustration">
                  <img src={cuteDiaryImg} alt="Cute diary" />
                  <div className="illustration-text">
                    Unlock your diary to view your private entries
                  </div>
                </div>
              ) : entries.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-emoji">📭</div>
                  No entries yet.
                </div>
              ) : (
                entries.map((e, i) => (
                  <div key={e.index} className="entry-card">
                    <div className="entry-tag">
                      Entry #{entries.length - i}
                    </div>

                    <div className="entry-meta">
                      <span>{e.timestamp.toLocaleString()}</span>
                      <span className="chip-small">Encrypted</span>
                    </div>

                    {/* Version + hash */}
                    <div
                      className="entry-meta"
                      style={{ marginTop: "4px", fontSize: "0.7rem" }}
                    >
                      <span>version: {e.version}</span>
                      <span>
                        hash: {String(e.hash).slice(0, 12)}
                        ...
                      </span>
                    </div>

                    <div className="entry-body entry-locked">
                      🔒 Encrypted — unlock to read.
                    </div>

                    {/* Actions row */}
                    <div className="entry-buttons">
                      <button
                        className="btn-secondary"
                        onClick={() => handleDecrypt(e)}
                      >
                        Decrypt
                      </button>

                      <button
                        className="btn-secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(e.cipherB64 || "");
                          alert("Copied encrypted text");
                        }}
                      >
                        Copy
                      </button>

                      <button
                        className="btn-secondary"
                        onClick={() => viewOnChain(e)}
                      >
                        View on-chain
                      </button>

                      <button
                        className="btn-secondary"
                        onClick={() => {
                          const newPlain = prompt(
                            "Enter new text to update (this will be encrypted):"
                          );
                          if (newPlain !== null) handleUpdate(e, newPlain);
                        }}
                      >
                        Update
                      </button>

                      <button
                        className="btn-secondary"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Delete this entry? (soft delete on-chain)"
                            )
                          ) {
                            handleDelete(e);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>

                    {/* Delegation row */}
                    <div style={{ marginTop: "8px" }}>
                      <input
                        className="diary-input"
                        style={{ fontSize: "0.75rem", padding: "6px 10px" }}
                        placeholder="Delegate address (0x...)"
                        id={`del-${e.index}`}
                      />
                      <div
                        style={{
                          marginTop: "6px",
                          display: "flex",
                          gap: "8px",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            const addr = document
                              .getElementById(`del-${e.index}`)
                              ?.value.trim();
                            if (!addr) return alert("Enter delegate addr");
                            handleGrant(e, addr);
                          }}
                        >
                          Grant
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            const addr = document
                              .getElementById(`del-${e.index}`)
                              ?.value.trim();
                            if (!addr) return alert("Enter delegate addr");
                            handleRevoke(e, addr);
                          }}
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* MODAL FOR DECRYPTED ENTRY */}
        {activeEntry && (
          <div className="modal-backdrop" onClick={closeModal}>
            <div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <span className="modal-title">Diary Entry</span>
                <button className="modal-close" onClick={closeModal}>
                  ✕
                </button>
              </div>

              <div className="modal-meta">
                {activeEntry.timestamp.toLocaleString()}
              </div>

              <div className="modal-body">{activeEntry.plainText}</div>
            </div>
          </div>
        )}

        {onChainEntry && (
          <div
            className="modal-backdrop"
            onClick={() => setOnChainEntry(null)}
          >
            <div
              className="modal-card onchain"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <span className="modal-title">On-chain Entry</span>
                <button
                  className="modal-close"
                  onClick={() => setOnChainEntry(null)}
                >
                  ✕
                </button>
              </div>

              <div className="modal-meta">
                {onChainEntry.timestamp
                  ? onChainEntry.timestamp.toLocaleString()
                  : "No timestamp"}
              </div>

              <div className="modal-body">
                <strong>Index:</strong> {onChainEntry.index}
                {"\n"}
                <strong>Version:</strong> {onChainEntry.version}
                {"\n"}
                <strong>Deleted:</strong> {String(onChainEntry.deleted)}
                {"\n"}
                <strong>Hash:</strong> {onChainEntry.hash}
                {"\n\n"}
                <strong>Cipher:</strong>
                <pre style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                  {onChainEntry.cipher}
                </pre>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}