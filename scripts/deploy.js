const { ethers } = require("hardhat");
const { createInstance } = require("fhevmjs");

/**
 * Deploy voting system contract
 */
async function main() {
    console.log("\n🗳️  Starting voting system deployment...");
    console.log("=".repeat(50));

    // Get deployment account
    const [deployer] = await ethers.getSigners();
    console.log(`📋 Deployment account: ${deployer.address}`);
    
    // Get account balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 Account balance: ${ethers.formatEther(balance)} ETH`);

    try {
        // Deploy voting system contract
        console.log("\n📦 Deploying VotingSystem contract...");
        const VotingSystem = await ethers.getContractFactory("VotingSystem");
        const votingSystem = await VotingSystem.deploy();
        await votingSystem.waitForDeployment();
        
        console.log(`✅ VotingSystem deployed successfully!`);
        console.log(`📍 Contract address: ${await votingSystem.getAddress()}`);
        console.log(`🔗 Transaction hash: ${votingSystem.deploymentTransaction().hash}`);
        
        // Wait for block confirmations
        console.log("\n⏳ Waiting for block confirmations...");
        await votingSystem.deploymentTransaction().wait(2);
        console.log("✅ Block confirmations completed");

        // Verify contract deployment
        console.log("\n🔍 Verifying contract deployment...");
        const owner = await votingSystem.owner();
        const proposalCount = await votingSystem.proposalCount();
        
        console.log(`👤 Contract owner: ${owner}`);
        console.log(`📊 Proposal count: ${proposalCount}`);
        
        // Skip FHEVM demonstration for now due to KMS setup requirements
         console.log("\n⚠️  Skipping FHEVM demonstration (requires KMS setup)");
         console.log("Contract deployed successfully and ready for use!");
        
        // Deployment summary
        console.log("\n" + "=".repeat(50));
        console.log("🎉 Voting system deployment completed!");
        console.log("=".repeat(50));
        
        console.log("\n📋 Deployment information:");
        console.log(`   Contract address: ${await votingSystem.getAddress()}`);
        console.log(`   Network: ${network.name}`);
        console.log(`   Deployer: ${deployer.address}`);
        console.log(`   Gas used: ${votingSystem.deploymentTransaction().gasLimit}`);
        
        console.log("\n🔧 Contract features:");
        console.log(`   ✅ Confidential voting (using FHEVM encryption)`);
        console.log(`   ✅ Proposal management`);
        console.log(`   ✅ Voting power control`);
        console.log(`   ✅ Time-limited voting`);
        console.log(`   ✅ Anti-fraud mechanism`);
        
        console.log("\n🎯 Next steps:");
        console.log(`   1. Connect to contract address in frontend: ${await votingSystem.getAddress()}`);
        console.log(`   2. Add more authorized voters`);
        console.log(`   3. Create more voting proposals`);
        console.log(`   4. Test complete voting process`);
        
        // Save deployment information to file
        const deploymentInfo = {
            contractName: "VotingSystem",
            address: await votingSystem.getAddress(),
            network: network.name,
            deployer: deployer.address,
            deploymentTime: new Date().toISOString(),
            transactionHash: votingSystem.deploymentTransaction().hash,
            blockNumber: votingSystem.deploymentTransaction().blockNumber
        };
        
        const fs = require('fs');
        const path = require('path');
        
        // Ensure deployments directory exists
        const deploymentsDir = path.join(__dirname, '..', 'deployments');
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }
        
        // Save deployment information
        const deploymentFile = path.join(deploymentsDir, `voting-${network.name}.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        console.log(`\n💾 Deployment information saved to: ${deploymentFile}`);
        
        return {
            votingSystem: await votingSystem.getAddress(),
            deployer: deployer.address,
            network: network.name
        };
        
    } catch (error) {
        console.error("\n❌ Deployment failed:");
        console.error(error.message);
        
        if (error.transaction) {
            console.error(`Transaction hash: ${error.transaction.hash}`);
        }
        
        process.exit(1);
    }
}

// Error handling
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise rejection:', error);
    process.exit(1);
});

// If running this script directly
if (require.main === module) {
    main()
        .then(() => {
            console.log("\n✅ Script execution completed");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ Script execution failed:", error);
            process.exit(1);
        });
}

module.exports = main;