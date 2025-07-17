const { ethers } = require("hardhat");
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

async function analyzeExistingContract() {
  console.log("\n🔍 现有合约分析工具");
  console.log("=" * 30);
  
  try {
    // 获取用户输入的合约地址
    const contractAddress = await askQuestion("请输入现有合约地址: ");
    
    if (!ethers.utils.isAddress(contractAddress)) {
      console.log("❌ 无效的合约地址");
      rl.close();
      return;
    }
    
    console.log("\n📊 分析合约:", contractAddress);
    
    // 获取网络信息
    const network = await ethers.provider.getNetwork();
    console.log("网络:", network.name, "(Chain ID:", network.chainId + ")");
    
    // 检查合约是否存在
    const code = await ethers.provider.getCode(contractAddress);
    if (code === "0x") {
      console.log("❌ 合约不存在或已销毁");
      rl.close();
      return;
    }
    
    console.log("✅ 合约存在");
    console.log("合约代码大小:", (code.length - 2) / 2, "字节");
    
    // 获取合约余额
    const balance = await ethers.provider.getBalance(contractAddress);
    console.log("合约余额:", ethers.utils.formatEther(balance), "ETH");
    
    // 获取最近的交易
    const latestBlock = await ethers.provider.getBlockNumber();
    console.log("当前区块:", latestBlock);
    
    // 尝试获取合约创建信息
    console.log("\n🔍 搜索合约创建交易...");
    let creationBlock = null;
    let creationTx = null;
    
    // 二分搜索找到合约创建区块（简化版本）
    for (let i = Math.max(0, latestBlock - 1000); i <= latestBlock; i += 100) {
      try {
        const blockCode = await ethers.provider.getCode(contractAddress, i);
        if (blockCode !== "0x") {
          creationBlock = i;
          break;
        }
      } catch (error) {
        // 忽略错误，继续搜索
      }
    }
    
    if (creationBlock) {
      console.log("✅ 合约创建区块:", creationBlock);
    } else {
      console.log("⚠️  未找到合约创建区块（可能创建时间较早）");
    }
    
    // 分析合约类型
    console.log("\n🔬 合约类型分析");
    
    // 检查是否是投票合约的常见特征
    const votingPatterns = [
      "vote",
      "ballot",
      "proposal",
      "candidate",
      "election"
    ];
    
    let isVotingContract = false;
    for (const pattern of votingPatterns) {
      if (code.toLowerCase().includes(pattern)) {
        isVotingContract = true;
        break;
      }
    }
    
    if (isVotingContract) {
      console.log("🗳️  可能是投票相关合约");
    } else {
      console.log("❓ 未识别的合约类型");
    }
    
    // 迁移建议
    console.log("\n💡 迁移建议");
    console.log("=" * 20);
    
    if (isVotingContract) {
      console.log("✅ 检测到投票合约特征，建议迁移到FHEVM投票系统");
      console.log("\n📋 迁移步骤:");
      console.log("1. 暂停现有合约的新操作");
      console.log("2. 导出现有投票数据");
      console.log("3. 部署新的FHEVM投票合约");
      console.log("4. 将历史数据迁移到新合约");
      console.log("5. 更新前端接口");
      console.log("6. 通知用户切换到新系统");
      
      console.log("\n🔧 可用工具:");
      console.log("- npm run export-data    # 导出现有数据");
      console.log("- npm run migrate-data   # 迁移数据到新合约");
      console.log("- npm run verify-migration # 验证迁移结果");
    } else {
      console.log("⚠️  非投票合约，需要手动分析迁移方案");
      console.log("\n建议步骤:");
      console.log("1. 分析合约功能和数据结构");
      console.log("2. 确定哪些数据需要隐私保护");
      console.log("3. 设计FHEVM版本的合约");
      console.log("4. 制定数据迁移计划");
    }
    
    // 风险评估
    console.log("\n⚠️  风险评估");
    console.log("=" * 15);
    
    const balanceEth = parseFloat(ethers.utils.formatEther(balance));
    if (balanceEth > 0.1) {
      console.log("🔴 高风险: 合约持有大量ETH，迁移需谨慎");
    } else if (balanceEth > 0.01) {
      console.log("🟡 中风险: 合约持有少量ETH");
    } else {
      console.log("🟢 低风险: 合约ETH余额较少");
    }
    
    const codeSize = (code.length - 2) / 2;
    if (codeSize > 20000) {
      console.log("🔴 复杂合约: 代码量大，迁移复杂度高");
    } else if (codeSize > 5000) {
      console.log("🟡 中等复杂度合约");
    } else {
      console.log("🟢 简单合约: 迁移相对容易");
    }
    
    // 下一步操作建议
    console.log("\n🎯 下一步操作");
    console.log("=" * 15);
    console.log("1. 运行 'npm run export-data' 导出现有数据");
    console.log("2. 查看 '../CONTRACT_MIGRATION.md' 了解详细迁移指南");
    console.log("3. 在测试网先进行迁移测试");
    console.log("4. 制定详细的迁移计划和时间表");
    
  } catch (error) {
    console.error("❌ 分析失败:", error.message);
  } finally {
    rl.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  analyzeExistingContract()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { analyzeExistingContract };