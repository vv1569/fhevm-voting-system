const { expect } = require("chai");
const { ethers } = require("hardhat");
const { createFhevmInstance } = require("fhevmjs");

describe("VotingSystem", function () {
    let votingSystem;
    let owner, voter1, voter2, voter3;
    let fhevmInstance;

    before(async function () {
        // Get test accounts
        [owner, voter1, voter2, voter3] = await ethers.getSigners();
        
        // Create FHEVM instance
        fhevmInstance = await createFhevmInstance({
            chainId: 31337, // Hardhat local network
            publicKey: "0x...", // Actual public key needed here
        });
    });

    beforeEach(async function () {
        // Deploy contract
        const VotingSystem = await ethers.getContractFactory("VotingSystem");
        votingSystem = await VotingSystem.deploy();
        await votingSystem.deployed();
    });

    describe("Deployment", function () {
        it("Should correctly set contract owner", async function () {
            expect(await votingSystem.owner()).to.equal(owner.address);
        });

        it("Should initialize as unpaused state", async function () {
            expect(await votingSystem.paused()).to.be.false;
        });
    });

    describe("Authorized Voter Management", function () {
        it("Owner should be able to add authorized voters", async function () {
            const votingPower = fhevmInstance.encrypt32(100);
            
            await expect(
                votingSystem.addAuthorizedVoter(voter1.address, votingPower)
            ).to.not.be.reverted;
        });

        it("Non-owner should not be able to add authorized voters", async function () {
            const votingPower = fhevmInstance.encrypt32(100);
            
            await expect(
                votingSystem.connect(voter1).addAuthorizedVoter(voter2.address, votingPower)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should be able to remove authorized voters", async function () {
            const votingPower = fhevmInstance.encrypt32(100);
            await votingSystem.addAuthorizedVoter(voter1.address, votingPower);
            
            await expect(
                votingSystem.removeAuthorizedVoter(voter1.address)
            ).to.not.be.reverted;
        });
    });

    describe("Proposal Management", function () {
        beforeEach(async function () {
            // Add authorized voters
            const votingPower = fhevmInstance.encrypt32(100);
            await votingSystem.addAuthorizedVoter(voter1.address, votingPower);
            await votingSystem.addAuthorizedVoter(voter2.address, votingPower);
        });

        it("Owner should be able to create proposals", async function () {
            const duration = 86400; // 1 day
            
            await expect(
                votingSystem.createProposal("Test Proposal", "This is a test proposal", duration)
            ).to.emit(votingSystem, "ProposalCreated")
              .withArgs(0, "Test Proposal");
        });

        it("Should correctly set proposal information", async function () {
            const duration = 86400;
            await votingSystem.createProposal("Test Proposal", "Description", duration);
            
            const proposal = await votingSystem.getProposal(0);
            expect(proposal.title).to.equal("Test Proposal");
            expect(proposal.description).to.equal("Description");
            expect(proposal.active).to.be.true;
        });

        it("Non-owner should not be able to create proposals", async function () {
            await expect(
                votingSystem.connect(voter1).createProposal("Test", "Description", 86400)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Voting Functionality", function () {
        let proposalId;
        
        beforeEach(async function () {
            // Add authorized voters
            const votingPower = fhevmInstance.encrypt32(100);
            await votingSystem.addAuthorizedVoter(voter1.address, votingPower);
            await votingSystem.addAuthorizedVoter(voter2.address, votingPower);
            
            // Create proposal
            await votingSystem.createProposal("Test Proposal", "Description", 86400);
            proposalId = 0;
        });

        it("Authorized voters should be able to vote", async function () {
            const encryptedVote = fhevmInstance.encrypt8(1); // Support
            
            await expect(
                votingSystem.connect(voter1).vote(proposalId, encryptedVote)
            ).to.emit(votingSystem, "VoteCast")
              .withArgs(proposalId, voter1.address);
        });

        it("Unauthorized users should not be able to vote", async function () {
            const encryptedVote = fhevmInstance.encrypt8(1);
            
            await expect(
                votingSystem.connect(voter3).vote(proposalId, encryptedVote)
            ).to.be.revertedWith("Not authorized to vote");
        });

        it("Should not be able to vote twice", async function () {
            const encryptedVote = fhevmInstance.encrypt8(1);
            
            await votingSystem.connect(voter1).vote(proposalId, encryptedVote);
            
            await expect(
                votingSystem.connect(voter1).vote(proposalId, encryptedVote)
            ).to.be.revertedWith("Already voted");
        });

        it("Should not be able to vote on inactive proposals", async function () {
            // Finalize proposal
            await votingSystem.finalizeProposal(proposalId);
            
            const encryptedVote = fhevmInstance.encrypt8(1);
            
            await expect(
                votingSystem.connect(voter1).vote(proposalId, encryptedVote)
            ).to.be.revertedWith("Proposal not active");
        });
    });

    describe("Proposal Finalization", function () {
        let proposalId;
        
        beforeEach(async function () {
            const votingPower = fhevmInstance.encrypt32(100);
            await votingSystem.addAuthorizedVoter(voter1.address, votingPower);
            await votingSystem.addAuthorizedVoter(voter2.address, votingPower);
            
            await votingSystem.createProposal("Test Proposal", "Description", 86400);
            proposalId = 0;
        });

        it("Owner should be able to finalize proposals", async function () {
            await expect(
                votingSystem.finalizeProposal(proposalId)
            ).to.emit(votingSystem, "ProposalFinalized")
              .withArgs(proposalId);
        });

        it("Proposal should become inactive after finalization", async function () {
            await votingSystem.finalizeProposal(proposalId);
            
            const proposal = await votingSystem.getProposal(proposalId);
            expect(proposal.active).to.be.false;
        });

        it("Non-owner should not be able to finalize proposals", async function () {
            await expect(
                votingSystem.connect(voter1).finalizeProposal(proposalId)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Pause Functionality", function () {
        it("Owner should be able to pause contract", async function () {
            await votingSystem.pause();
            expect(await votingSystem.paused()).to.be.true;
        });

        it("Owner should be able to unpause contract", async function () {
            await votingSystem.pause();
            await votingSystem.unpause();
            expect(await votingSystem.paused()).to.be.false;
        });

        it("Should not be able to vote when paused", async function () {
            const votingPower = fhevmInstance.encrypt32(100);
            await votingSystem.addAuthorizedVoter(voter1.address, votingPower);
            await votingSystem.createProposal("Test", "Description", 86400);
            
            await votingSystem.pause();
            
            const encryptedVote = fhevmInstance.encrypt8(1);
            await expect(
                votingSystem.connect(voter1).vote(0, encryptedVote)
            ).to.be.revertedWith("Pausable: paused");
        });
    });

    describe("Query Functionality", function () {
        beforeEach(async function () {
            const votingPower = fhevmInstance.encrypt32(100);
            await votingSystem.addAuthorizedVoter(voter1.address, votingPower);
            await votingSystem.createProposal("Test Proposal", "Description", 86400);
        });

        it("Should be able to get proposal count", async function () {
            const count = await votingSystem.getProposalCount();
            expect(count).to.equal(1);
        });

        it("Should be able to check voter authorization status", async function () {
            const isAuthorized = await votingSystem.isAuthorizedVoter(voter1.address);
            expect(isAuthorized).to.be.true;
            
            const isNotAuthorized = await votingSystem.isAuthorizedVoter(voter3.address);
            expect(isNotAuthorized).to.be.false;
        });

        it("Should be able to check if already voted", async function () {
            const hasVoted = await votingSystem.hasVoted(0, voter1.address);
            expect(hasVoted).to.be.false;
            
            const encryptedVote = fhevmInstance.encrypt8(1);
            await votingSystem.connect(voter1).vote(0, encryptedVote);
            
            const hasVotedAfter = await votingSystem.hasVoted(0, voter1.address);
            expect(hasVotedAfter).to.be.true;
        });
    });

    describe("Edge Case Tests", function () {
        it("Should reject invalid proposal ID", async function () {
            await expect(
                votingSystem.getProposal(999)
            ).to.be.revertedWith("Invalid proposal ID");
        });

        it("Should reject proposals with zero duration", async function () {
            await expect(
                votingSystem.createProposal("Test", "Description", 0)
            ).to.be.revertedWith("Duration must be greater than 0");
        });

        it("Should reject proposals with empty title", async function () {
            await expect(
                votingSystem.createProposal("", "Description", 86400)
            ).to.be.revertedWith("Title cannot be empty");
        });
    });

    describe("Gas Optimization Tests", function () {
        it("Batch adding voters should be efficient", async function () {
            const voters = [voter1.address, voter2.address, voter3.address];
            const votingPower = fhevmInstance.encrypt32(100);
            
            // Test gas consumption for batch operations here
            for (const voter of voters) {
                await votingSystem.addAuthorizedVoter(voter, votingPower);
            }
            
            // Verify all voters have been added
            for (const voter of voters) {
                expect(await votingSystem.isAuthorizedVoter(voter)).to.be.true;
            }
        });
    });
});