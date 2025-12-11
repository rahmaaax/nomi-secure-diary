pragma solidity ^0.8.19;

contract DigitalDiaryFinal {
    // Mapping from user address => array of IPFS CIDs
    mapping(address => string[]) private entries;

    // Event: author, index, cid, timestamp
    event EntryAdded(address indexed author, uint256 indexed index, string cid, uint256 timestamp);

    /// @notice Add an entry's IPFS CID for the caller
    /// @param cid IPFS CID (prefer CIDv1 base32 strings)
    function addEntry(string calldata cid) external {
        entries[msg.sender].push(cid);
        uint256 idx = entries[msg.sender].length - 1;
        emit EntryAdded(msg.sender, idx, cid, block.timestamp);
    }

    /// @notice Get a single entry by owner and index
    function getEntry(address owner, uint256 index) external view returns (string memory) {
        require(index < entries[owner].length, "Index OOB");
        return entries[owner][index];
    }

    /// @notice Number of entries for an address
    function entryCount(address owner) external view returns (uint256) {
        return entries[owner].length;
    }

    /// @notice Return all entries for an owner (OK for demo / small arrays)
    function getAllEntries(address owner) external view returns (string[] memory) {
        return entries[owner];
    }
}
