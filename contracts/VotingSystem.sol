// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./TFHE.sol";

/**
 * @title VotingSystem
 * @dev Confidential voting system based on FHEVM
 * @notice Supports fully encrypted voting process, protecting voter privacy
 */
contract VotingSystem {
    using TFHE for euint8;
    using TFHE for euint32;
    using TFHE for ebool;

    // Proposal structure
    struct Proposal {
        uint256 id;
        string title;
        string description;
        address creator;
        uint256 startTime;
        uint256 endTime;
        euint32 yesVotes;     // Encrypted yes votes
        euint32 noVotes;      // Encrypted no votes
        euint32 abstainVotes; // Encrypted abstain votes
        bool finalized;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    // Vote choice enumeration
    enum VoteChoice { YES, NO, ABSTAIN }

    // State variables
    address public owner;
    uint256 public proposalCount;
    uint256 public constant VOTING_DURATION = 7 days;
    uint256 public constant MIN_VOTING_POWER = 1;
    
    // Store proposals
    mapping(uint256 => Proposal) public proposals;
    
    // User voting power (encrypted)
    mapping(address => euint32) public votingPower;
    
    // Authorized voters
    mapping(address => bool) public authorizedVoters;
    
    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        string title,
        address indexed creator,
        uint256 startTime,
        uint256 endTime
    );
    
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        uint256 timestamp
    );
    
    event ProposalFinalized(
        uint256 indexed proposalId,
        bool passed,
        uint256 timestamp
    );
    
    event VoterAuthorized(address indexed voter, uint32 power);
    event VoterRevoked(address indexed voter);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier onlyAuthorizedVoter() {
        require(authorizedVoters[msg.sender], "Not authorized to vote");
        _;
    }
    
    modifier proposalExists(uint256 proposalId) {
        require(proposalId < proposalCount, "Proposal does not exist");
        _;
    }
    
    modifier votingActive(uint256 proposalId) {
        require(
            block.timestamp >= proposals[proposalId].startTime &&
            block.timestamp <= proposals[proposalId].endTime,
            "Voting period not active"
        );
        _;
    }
    
    modifier votingEnded(uint256 proposalId) {
        require(
            block.timestamp > proposals[proposalId].endTime,
            "Voting period still active"
        );
        _;
    }

    /**
     * @dev Constructor
     */
    constructor() {
        owner = msg.sender;
        
        // Authorize deployer as voter
        authorizedVoters[msg.sender] = true;
        votingPower[msg.sender] = TFHE.asEuint32(100); // Give deployer 100 voting power
        
        emit VoterAuthorized(msg.sender, 100);
    }

    /**
     * @dev Create new proposal
     * @param title Proposal title
     * @param description Proposal description
     * @param duration Voting duration in seconds
     */
    function createProposal(
        string memory title,
        string memory description,
        uint256 duration
    ) external onlyAuthorizedVoter returns (uint256) {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(duration >= 1 hours && duration <= 30 days, "Invalid duration");
        
        uint256 proposalId = proposalCount++;
        Proposal storage newProposal = proposals[proposalId];
        
        newProposal.id = proposalId;
        newProposal.title = title;
        newProposal.description = description;
        newProposal.creator = msg.sender;
        newProposal.startTime = block.timestamp;
        newProposal.endTime = block.timestamp + duration;
        newProposal.yesVotes = TFHE.asEuint32(0);
        newProposal.noVotes = TFHE.asEuint32(0);
        newProposal.abstainVotes = TFHE.asEuint32(0);
        newProposal.finalized = false;
        newProposal.executed = false;
        
        emit ProposalCreated(
            proposalId,
            title,
            msg.sender,
            newProposal.startTime,
            newProposal.endTime
        );
        
        return proposalId;
    }

    /**
     * @dev Vote on proposal
     * @param proposalId Proposal ID
     * @param encryptedChoice Encrypted vote choice
     */
    function vote(
        uint256 proposalId,
        einput encryptedChoice,
        bytes calldata inputProof
    ) external 
        onlyAuthorizedVoter
        proposalExists(proposalId)
        votingActive(proposalId)
    {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        // Decrypt vote choice
        euint8 choice = TFHE.asEuint8(encryptedChoice, inputProof);
        euint32 voterPower = votingPower[msg.sender];
        
        // Validate vote choice (0=YES, 1=NO, 2=ABSTAIN)
        ebool validChoice = TFHE.le(choice, TFHE.asEuint8(2));
        require(TFHE.decrypt(validChoice), "Invalid vote choice");
        
        // Update corresponding vote count based on choice
        ebool isYes = TFHE.eq(choice, TFHE.asEuint8(0));
        ebool isNo = TFHE.eq(choice, TFHE.asEuint8(1));
        ebool isAbstain = TFHE.eq(choice, TFHE.asEuint8(2));
        
        // Use conditional addition to update vote counts
        proposal.yesVotes = TFHE.add(
            proposal.yesVotes,
            TFHE.select(isYes, voterPower, TFHE.asEuint32(0))
        );
        
        proposal.noVotes = TFHE.add(
            proposal.noVotes,
            TFHE.select(isNo, voterPower, TFHE.asEuint32(0))
        );
        
        proposal.abstainVotes = TFHE.add(
            proposal.abstainVotes,
            TFHE.select(isAbstain, voterPower, TFHE.asEuint32(0))
        );
        
        // Mark as voted
        proposal.hasVoted[msg.sender] = true;
        
        emit VoteCast(proposalId, msg.sender, block.timestamp);
    }

    /**
     * @dev Finalize voting and calculate results
     * @param proposalId Proposal ID
     */
    function finalizeProposal(uint256 proposalId)
        external
        proposalExists(proposalId)
        votingEnded(proposalId)
    {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.finalized, "Proposal already finalized");
        
        // Compare yes votes and no votes
        ebool passed = TFHE.gt(proposal.yesVotes, proposal.noVotes);
        bool proposalPassed = TFHE.decrypt(passed);
        
        proposal.finalized = true;
        
        emit ProposalFinalized(proposalId, proposalPassed, block.timestamp);
    }

    /**
     * @dev Authorize voter
     * @param voter Voter address
     * @param power Voting power
     */
    function authorizeVoter(address voter, uint32 power) external onlyOwner {
        require(voter != address(0), "Invalid voter address");
        require(power >= MIN_VOTING_POWER, "Insufficient voting power");
        require(power <= 1000, "Voting power too high");
        
        authorizedVoters[voter] = true;
        votingPower[voter] = TFHE.asEuint32(power);
        
        emit VoterAuthorized(voter, power);
    }

    /**
     * @dev Revoke voter authorization
     * @param voter Voter address
     */
    function revokeVoter(address voter) external onlyOwner {
        require(voter != owner, "Cannot revoke owner");
        require(authorizedVoters[voter], "Voter not authorized");
        
        authorizedVoters[voter] = false;
        votingPower[voter] = TFHE.asEuint32(0);
        
        emit VoterRevoked(voter);
    }

    /**
     * @dev Get proposal information (public part)
     * @param proposalId Proposal ID
     */
    function getProposal(uint256 proposalId)
        external
        view
        proposalExists(proposalId)
        returns (
            string memory title,
            string memory description,
            address creator,
            uint256 startTime,
            uint256 endTime,
            bool finalized,
            bool executed
        )
    {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.title,
            proposal.description,
            proposal.creator,
            proposal.startTime,
            proposal.endTime,
            proposal.finalized,
            proposal.executed
        );
    }

    /**
     * @dev Get encrypted voting results (authorized users only)
     * @param proposalId Proposal ID
     */
    function getEncryptedResults(uint256 proposalId)
        external
        view
        onlyAuthorizedVoter
        proposalExists(proposalId)
        returns (euint32 yesVotes, euint32 noVotes, euint32 abstainVotes)
    {
        Proposal storage proposal = proposals[proposalId];
        return (proposal.yesVotes, proposal.noVotes, proposal.abstainVotes);
    }

    /**
     * @dev Check if user has voted
     * @param proposalId Proposal ID
     * @param voter Voter address
     */
    function hasVoted(uint256 proposalId, address voter)
        external
        view
        proposalExists(proposalId)
        returns (bool)
    {
        return proposals[proposalId].hasVoted[voter];
    }

    /**
     * @dev Get user voting power (encrypted)
     * @param voter Voter address
     */
    function getVotingPower(address voter)
        external
        view
        onlyAuthorizedVoter
        returns (euint32)
    {
        return votingPower[voter];
    }

    /**
     * @dev Check if voting is still active
     * @param proposalId Proposal ID
     */
    function isVotingActive(uint256 proposalId)
        external
        view
        proposalExists(proposalId)
        returns (bool)
    {
        Proposal storage proposal = proposals[proposalId];
        return (
            block.timestamp >= proposal.startTime &&
            block.timestamp <= proposal.endTime
        );
    }

    /**
     * @dev Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        require(newOwner != owner, "New owner cannot be current owner");
        
        // Authorize new owner as voter
        authorizedVoters[newOwner] = true;
        votingPower[newOwner] = TFHE.asEuint32(100);
        
        owner = newOwner;
        
        emit VoterAuthorized(newOwner, 100);
    }

    /**
     * @dev Batch authorize voters
     * @param voters Array of voter addresses
     * @param powers Array of corresponding voting powers
     */
    function batchAuthorizeVoters(
        address[] calldata voters,
        uint32[] calldata powers
    ) external onlyOwner {
        require(voters.length == powers.length, "Arrays length mismatch");
        require(voters.length <= 50, "Too many voters");
        
        for (uint256 i = 0; i < voters.length; i++) {
            require(voters[i] != address(0), "Invalid voter address");
            require(powers[i] >= MIN_VOTING_POWER && powers[i] <= 1000, "Invalid voting power");
            
            authorizedVoters[voters[i]] = true;
            votingPower[voters[i]] = TFHE.asEuint32(powers[i]);
            
            emit VoterAuthorized(voters[i], powers[i]);
        }
    }

    /**
     * @dev Get total number of proposals
     */
    function getProposalCount() external view returns (uint256) {
        return proposalCount;
    }
}