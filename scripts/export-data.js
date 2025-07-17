const { ethers } = require("hardhat");
const fs = require('fs');
const readline = require('readline');

// 创建命令行接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 提示用户输入
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// 常见的投票合约ABI模板
const COMMON_VOTING_ABI = [
  "function totalVotes() view returns (uint256)",
  "function votingEndTime() view returns (uint256)",
  "function votingStartTime() view returns (uint256)",
  "function proposalCount() view returns (uint256)",
  "function getProposal(uint256) view returns (string, uint256)",
  "function hasVoted(address) view returns (bool)",
  "function votes(address) view returns (uint256)",
  "function proposals(uint256) view returns (string, uint256)",
  "event VoteCast(address indexed voter, uint256 indexed proposal, uint256 weight)",
  "event ProposalCreated(uint256 indexed proposalId, string description)",
  "event VotingStarted(uint256 startTime, uint256 endTime)",
  "event VotingEnded(uint256 endTime, uint256 winningProposal)"
];

async function exportContractData() {
  console.log("\n📤 合约数据导出工具");
  console.log("=" * 30);
  
  try {
    // 获取合约地址
    const contractAddress = await askQuestion("请输入要导出的合约地址: ");
    
    if (!ethers.utils.isAddress(contractAddress)) {
      console.log("❌ 无效的合约地址");
      rl.close();
      return;
    }
    
    console.log("\n🔍 分析合约:", contractAddress);
    
    // 检查合约是否存在
    const code = await ethers.provider.getCode(contractAddress);
    if (code === "0x") {
      console.log("❌ 合约不存在");
      rl.close();
      return;
    }
    
    // 询问用户是否有ABI文件
    const hasABI = await askQuestion("是否有合约ABI文件? (y/n): ");
    
    let contract;
    let abi;
    
    if (hasABI.toLowerCase() === 'y') {
      const abiPath = await askQuestion("请输入ABI文件路径: ");
      try {
        abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        contract = new ethers.Contract(contractAddress, abi, ethers.provider);
        console.log("✅ 成功加载自定义ABI");
      } catch (error) {
        console.log("❌ ABI文件加载失败，使用通用ABI");
        abi = COMMON_VOTING_ABI;
        contract = new ethers.Contract(contractAddress, abi, ethers.provider);
      }
    } else {
      console.log("📋 使用通用投票合约ABI");
      abi = COMMON_VOTING_ABI;
      contract = new ethers.Contract(contractAddress, abi, ethers.provider);
    }
    
    // 创建导出数据结构
    const exportData = {
      metadata: {
        contractAddress,
        exportTime: new Date().toISOString(),
        network: (await ethers.provider.getNetwork()).name,
        chainId: (await ethers.provider.getNetwork()).chainId,
        blockNumber: await ethers.provider.getBlockNumber()
      },
      contractInfo: {
        codeSize: (code.length - 2) / 2,
        balance: ethers.utils.formatEther(await ethers.provider.getBalance(contractAddress))
      },
      data: {},
      events: {},
      errors: []
    };
    
    console.log("\n📊 导出合约状态数据...");
    
    // 尝试读取常见的状态变量
    const stateVariables = [
      'totalVotes',
      'votingEndTime', 
      'votingStartTime',
      'proposalCount',
      'owner',
      'paused'
    ];
    
    for (const variable of stateVariables) {
      try {
        const value = await contract[variable]();
        exportData.data[variable] = value.toString();
        console.log(`✅ ${variable}:`, value.toString());
      } catch (error) {
        exportData.errors.push(`无法读取 ${variable}: ${error.message}`);
        console.log(`⚠️  跳过 ${variable}:`, error.message.split('(')[0]);
      }
    }
    
    // 如果有proposalCount，尝试导出所有提案
    if (exportData.data.proposalCount) {
      console.log("\n📋 导出提案数据...");
      const proposalCount = parseInt(exportData.data.proposalCount);
      exportData.data.proposals = [];
      
      for (let i = 0; i < Math.min(proposalCount, 100); i++) { // 限制最多100个提案
        try {
          const proposal = await contract.getProposal(i);
          exportData.data.proposals.push({
            id: i,
            description: proposal[0] || proposal.description || 'N/A',
            voteCount: proposal[1] ? proposal[1].toString() : proposal.voteCount?.toString() || '0'
          });
          console.log(`✅ 提案 ${i}:`, proposal[0] || 'N/A');
        } catch (error) {
          try {
            // 尝试另一种方式
            const proposal = await contract.proposals(i);
            exportData.data.proposals.push({
              id: i,
              description: proposal[0] || proposal.description || 'N/A',
              voteCount: proposal[1] ? proposal[1].toString() : proposal.voteCount?.toString() || '0'
            });
            console.log(`✅ 提案 ${i}:`, proposal[0] || 'N/A');
          } catch (error2) {
            exportData.errors.push(`无法读取提案 ${i}: ${error2.message}`);
            console.log(`⚠️  跳过提案 ${i}`);
          }
        }
      }
    }
    
    console.log("\n📜 导出事件日志...");
    
    // 导出事件（最近1000个区块）
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000);
    
    const eventTypes = [
      'VoteCast',
      'ProposalCreated', 
      'VotingStarted',
      'VotingEnded'
    ];
    
    for (const eventType of eventTypes) {
      try {
        const filter = contract.filters[eventType]();
        const events = await contract.queryFilter(filter, fromBlock, currentBlock);
        
        exportData.events[eventType] = events.map(event => ({
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          logIndex: event.logIndex,
          args: event.args ? Object.keys(event.args).reduce((acc, key) => {
            if (isNaN(key)) { // 只保留命名参数
              acc[key] = event.args[key].toString();
            }
            return acc;
          }, {}) : {}
        }));
        
        console.log(`✅ ${eventType}: ${events.length} 个事件`);
      } catch (error) {
        exportData.errors.push(`无法读取事件 ${eventType}: ${error.message}`);
        console.log(`⚠️  跳过事件 ${eventType}:`, error.message.split('(')[0]);
      }
    }
    
    // 保存导出数据
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `voting-export-${timestamp}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
    
    console.log("\n✅ 数据导出完成!");
    console.log("📁 导出文件:", filename);
    console.log("📊 导出统计:");
    console.log(`   - 状态变量: ${Object.keys(exportData.data).length}`);
    console.log(`   - 事件类型: ${Object.keys(exportData.events).length}`);
    console.log(`   - 错误数量: ${exportData.errors.length}`);
    
    if (exportData.errors.length > 0) {
      console.log("\n⚠️  导出过程中的错误:");
      exportData.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    console.log("\n💡 下一步:");
    console.log("1. 检查导出的数据文件");
    console.log("2. 运行 'npm run migrate-data' 迁移数据到新合约");
    console.log("3. 验证迁移结果");
    
  } catch (error) {
    console.error("❌ 导出失败:", error.message);
  } finally {
    rl.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  exportContractData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { exportContractData };