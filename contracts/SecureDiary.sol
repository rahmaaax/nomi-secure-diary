// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

/// @title SecureDiary — per-owner diary with delegation, versioning, integrity checks
/// @notice Simple, minimal implementation to support: add, read (with delegation),
/// update (with optimistic version check), delete, grant/revoke delegate.
/// - Stores ciphertext (client-side encrypted) and a keccak256 hash of ciphertext for integrity/tracking.
/// - Each entry has a version number; update requires caller to pass the current expectedVersion to avoid replay/stale overwrites.
/// - Delegates are per-owner-per-index.
/// - Events emitted for auditing.
contract SecureDiary {
    error NotAuthorized();
    error EntryNotFound();
    error InvalidVersion();

    struct Entry {
        string cipherB64;    // ciphertext (base64 envelope: salt.iv.cipher)
        uint256 timestamp;   // epoch seconds
        bool deleted;
        uint256 version;     // incremental version for optimistic concurrency
        bytes32 cipherHash;  // keccak256 of cipherB64 for integrity checks
    }

    // entries[owner] => array of Entry
    mapping(address => Entry[]) private entriesByOwner;

    // delegates[owner][index][delegateAddr] => bool
    mapping(address => mapping(uint256 => mapping(address => bool))) public delegates;

    // Events
    event EntryAdded(address indexed owner, uint256 indexed index, uint256 timestamp, uint256 version, bytes32 cipherHash);
    event EntryUpdated(address indexed owner, uint256 indexed index, uint256 timestamp, uint256 version, bytes32 newHash);
    event EntryDeleted(address indexed owner, uint256 indexed index, uint256 timestamp, uint256 version);
    event DelegateGranted(address indexed owner, uint256 indexed index, address indexed delegate);
    event DelegateRevoked(address indexed owner, uint256 indexed index, address indexed delegate);

    /// @notice Add a new encrypted entry for msg.sender
    function addEntry(string calldata cipherB64) external {
        bytes32 h = keccak256(bytes(cipherB64));
        uint256 ts = block.timestamp;
        Entry memory e = Entry({
            cipherB64: cipherB64,
            timestamp: ts,
            deleted: false,
            version: 1,
            cipherHash: h
        });
        entriesByOwner[msg.sender].push(e);
        uint256 idx = entriesByOwner[msg.sender].length - 1;
        emit EntryAdded(msg.sender, idx, ts, 1, h);
    }

    /// @notice Returns number of entries for an owner
    function entryCount(address owner) external view returns (uint256) {
        return entriesByOwner[owner].length;
    }

    /// @notice Get all entries' ciphertexts and timestamps for an owner.
    /// Returns arrays: cipherB64[], timestamp[] , version[] , cipherHash[]
    function getAllEntries(address owner)
        external
        view
        returns (string[] memory, uint256[] memory, uint256[] memory, bytes32[] memory)
    {
        uint256 n = entriesByOwner[owner].length;
        string[] memory ciphers = new string[](n);
        uint256[] memory times = new uint256[](n);
        uint256[] memory versions = new uint256[](n);
        bytes32[] memory hashes = new bytes32[](n);

        for (uint256 i = 0; i < n; ++i) {
            Entry storage e = entriesByOwner[owner][i];
            ciphers[i] = e.cipherB64;
            times[i] = e.timestamp;
            versions[i] = e.version;
            hashes[i] = e.cipherHash;
        }
        return (ciphers, times, versions, hashes);
    }

    /// @notice Read a single entry for `owner` at `index`. Caller must be owner or a granted delegate.
    /// Returns: cipherB64, timestamp, version, cipherHash, deleted
    function getEntry(address owner, uint256 index)
        external
        view
        returns (string memory, uint256, uint256, bytes32, bool)
    {
        if (index >= entriesByOwner[owner].length) revert EntryNotFound();
        Entry storage e = entriesByOwner[owner][index];

        // permission check
        if (msg.sender != owner && !delegates[owner][index][msg.sender]) revert NotAuthorized();

        return (e.cipherB64, e.timestamp, e.version, e.cipherHash, e.deleted);
    }

    /// @notice Update an entry — only the owner can update. Caller must provide expectedVersion (optimistic concurrency).
    /// If expectedVersion doesn't match current version revert (prevents replay/stale update).
    function updateEntry(uint256 index, string calldata newCipherB64, uint256 expectedVersion) external {
        if (index >= entriesByOwner[msg.sender].length) revert EntryNotFound();
        Entry storage e = entriesByOwner[msg.sender][index];
        if (e.deleted) revert EntryNotFound();

        if (e.version != expectedVersion) revert InvalidVersion();

        e.cipherB64 = newCipherB64;
        e.cipherHash = keccak256(bytes(newCipherB64));
        e.version += 1;
        e.timestamp = block.timestamp;

        emit EntryUpdated(msg.sender, index, e.timestamp, e.version, e.cipherHash);
    }

    /// @notice Delete an entry (soft delete). Only owner.
    function deleteEntry(uint256 index) external {
        if (index >= entriesByOwner[msg.sender].length) revert EntryNotFound();
        Entry storage e = entriesByOwner[msg.sender][index];
        if (e.deleted) revert EntryNotFound();

        e.deleted = true;
        e.version += 1;
        e.timestamp = block.timestamp;

        emit EntryDeleted(msg.sender, index, e.timestamp, e.version);
    }

    /// @notice Grant delegate access for a specific entry (owner only)
    function grantDelegate(uint256 index, address delegateAddr) external {
        if (index >= entriesByOwner[msg.sender].length) revert EntryNotFound();
        delegates[msg.sender][index][delegateAddr] = true;
        emit DelegateGranted(msg.sender, index, delegateAddr);
    }

    /// @notice Revoke delegate access (owner only)
    function revokeDelegate(uint256 index, address delegateAddr) external {
        if (index >= entriesByOwner[msg.sender].length) revert EntryNotFound();
        delegates[msg.sender][index][delegateAddr] = false;
        emit DelegateRevoked(msg.sender, index, delegateAddr);
    }
}
