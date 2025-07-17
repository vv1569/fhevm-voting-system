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

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrateData() {
  console.log("\n🔄 数据迁移工具");
  console.log("=" * 25);
  
  try {
    // 1. 选择导出文件
    console.log("\n📁 查找导出文件...");
    const exportFiles = fs.readdirSync('.').filter(f => f.startsWith('voting-export-') && f.endsWith('.json'));
    
    if (exportFiles.length === 0) {
      console.log("❌ 未找到导出文件");
      console.log("💡 请先运行 'npm run export-data' 导出现有合约数据");
      rl.close();
      return;
    }
    
    console.log("\n📋 可用的导出文件:");
    exportFiles.forEach((file, index) => {
      const stats = fs.statSync(file);
      console.log(`${index + 1}. ${file} (${stats.size} bytes, ${stats.mtime.toLocaleString()})`);
    });
    
    const fileIndex = await askQuestion(`\n请选择导出文件 (1-${exportFiles.length}): `);
    const selectedFile = exportFiles[parseInt(fileIndex) - 1];
    
    if (!selectedFile) {
      console.log("❌ 无效的文件选择");
      rl.close();
      return;
    }
    
    console.log("✅ 选择文件:", selectedFile);
    
    // 2. 加载导出数据
    const exportData = JSON.parse(fs.readFileSync(selectedFile, 'utf8'));
    console.log("📊 导出数据概览:");
    console.log(`   - 原合约地址: ${exportData.metadata.contractAddress}`);
    console.log(`   - 导出时间: ${exportData.metadata.exportTime}`);
    console.log(`   - 网络: ${exportData.metadata.network}`);
    
    // 3. 部署新的FHEVM合约或使用现有合约
    const useExisting = await askQuestion("\n是否使用现有的FHEVM合约? (y/n): ");
    
    let newContract;
    let contractAddress;
    
    if (useExisting.toLowerCase() === 'y') {
      contractAddress = await askQuestion("请输入FHEVM合约地址: ");
      if (!ethers.utils.isAddress(contractAddress)) {
        console.log("❌ 无效的合约地址");
        rl.close();
        return;
      }
      
      // 连接到现有合约
      const VotingSystem = await ethers.getContractFactory("VotingSystem");
      newContract = VotingSystem.attach(contractAddress);
      console.log("✅ 连接到现有合约:", contractAddress);
    } else {
      // 部署新合约
      console.log("\n🚀 部署新的FHEVM投票合约...");
      const [deployer] = await ethers.getSigners();
      console.log("部署者地址:", deployer.address);
      
      const VotingSystem = await ethers.getContractFactory("VotingSystem");
      newContract = await VotingSystem.deploy();
      await newContract.deployed();
      
      contractAddress = newContract.address;
      console.log("✅ 新合约部署成功:", contractAddress);
    }
    
    // 4. 开始数据迁移
    console.log("\n🔄 开始数据迁移...");
    
    const migrationResults = {
      startTime: new Date().toISOString(),
      oldContract: exportData.metadata.contractAddress,
      newContract: contractAddress,
      migratedData: {},
      errors: [],
      transactions: []
    };
    
    // 4.1 迁移提案数据
    if (exportData.data.proposals && exportData.data.proposals.length > 0) {
      console.log("\n📋 迁移提案数据...");
      
      for (const proposal of exportData.data.proposals) {
        try {
          console.log(`📝 迁移提案 ${proposal.id}: ${proposal.description}`);
          
          // 检查合约是否有addProposal方法
          try {
            const tx = await newContract.addProposal(proposal.description);
            await tx.wait();
            
            migrationResults.transactions.push({
              type: 'addProposal',
              proposalId: proposal.id,
              txHash: tx.hash
            });
            
            console.log(`✅ 提案 ${proposal.id} 迁移成功 (tx: ${tx.hash})`);
            
            // 添加延迟避免网络拥堵
            await delay(1000);
            
          } catch (error) {
            if (error.message.includes('already exists')) {
              console.log(`⚠️  提案 ${proposal.id} 已存在，跳过`);
            } else {
              throw error;
            }
          }
          
        } catch (error) {
          const errorMsg = `提案 ${proposal.id} 迁移失败: ${error.message}`;
          migrationResults.errors.push(errorMsg);
          console.log(`❌ ${errorMsg}`);
        }
      }
      
      migrationResults.migratedData.proposals = exportData.data.proposals.length;
    }
    
    // 4.2 迁移投票事件（如果合约支持管理员投票迁移）
    if (exportData.events.VoteCast && exportData.events.VoteCast.length > 0) {
      console.log("\n🗳️  迁移投票数据...");
      
      const voteEvents = exportData.events.VoteCast;
      console.log(`发现 ${voteEvents.length} 个投票事件`);
      
      // 检查合约是否支持管理员迁移投票
      try {
        // 尝试调用迁移函数（如果存在）
        for (let i = 0; i < Math.min(voteEvents.length, 10); i++) { // 限制迁移数量
          const vote = voteEvents[i];
          
          try {
            // 假设合约有migrateVote函数
            if (newContract.migrateVote) {
              const tx = await newContract.migrateVote(
                vote.args.voter,
                vote.args.proposal,
                vote.args.weight || 1
              );
              await tx.wait();
              
              migrationResults.transactions.push({
                type: 'migrateVote',
                voter: vote.args.voter,
                txHash: tx.hash
              });
              
              console.log(`✅ 投票迁移成功: ${vote.args.voter} -> 提案 ${vote.args.proposal}`);
              await delay(1000);
            } else {
              console.log(`⚠️  合约不支持投票迁移，跳过投票数据`);
              break;
            }
          } catch (error) {
            const errorMsg = `投票迁移失败 (${vote.args.voter}): ${error.message}`;
            migrationResults.errors.push(errorMsg);
            console.log(`❌ ${errorMsg}`);
          }
        }
        
        migrationResults.migratedData.votes = Math.min(voteEvents.length, 10);
        
      } catch (error) {
        console.log(`⚠️  投票数据迁移不支持: ${error.message}`);
        migrationResults.errors.push(`投票迁移不支持: ${error.message}`);
      }
    }
    
    // 4.3 设置投票时间（如果需要）
    if (exportData.data.votingStartTime && exportData.data.votingEndTime) {
      console.log("\n⏰ 设置投票时间...");
      
      try {
        // 检查是否需要设置投票时间
        if (newContract.setVotingPeriod) {
          const tx = await newContract.setVotingPeriod(
            exportData.data.votingStartTime,
            exportData.data.votingEndTime
          );
          await tx.wait();
          
          migrationResults.transactions.push({
            type: 'setVotingPeriod',
            txHash: tx.hash
          });
          
          console.log(`✅ 投票时间设置成功 (tx: ${tx.hash})`);
        }
      } catch (error) {
        const errorMsg = `投票时间设置失败: ${error.message}`;
        migrationResults.errors.push(errorMsg);
        console.log(`❌ ${errorMsg}`);
      }
    }
    
    // 5. 保存迁移结果
    migrationResults.endTime = new Date().toISOString();
    migrationResults.duration = new Date(migrationResults.endTime) - new Date(migrationResults.startTime);
    
    const migrationFile = `migration-result-${Date.now()}.json`;
    fs.writeFileSync(migrationFile, JSON.stringify(migrationResults, null, 2));
    
    // 6. 显示迁移结果
    console.log("\n🎉 数据迁移完成!");
    console.log("=" * 25);
    console.log(`📁 迁移结果文件: ${migrationFile}`);
    console.log(`🏠 新合约地址: ${contractAddress}`);
    console.log(`⏱️  迁移耗时: ${Math.round(migrationResults.duration / 1000)} 秒`);
    console.log(`📊 迁移统计:`);
    
    Object.entries(migrationResults.migratedData).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value}`);
    });
    
    console.log(`💸 交易数量: ${migrationResults.transactions.length}`);
    console.log(`❌ 错误数量: ${migrationResults.errors.length}`);
    
    if (migrationResults.errors.length > 0) {
      console.log("\n⚠️  迁移过程中的错误:");
      migrationResults.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    console.log("\n💡 下一步:");
    console.log("1. 验证新合约的数据完整性");
    console.log("2. 更新前端应用的合约地址");
    console.log("3. 通知用户切换到新系统");
    console.log("4. 在确认无误后暂停旧合约");
    
    // 7. 验证迁移结果
    const shouldVerify = await askQuestion("\n是否立即验证迁移结果? (y/n): ");
    if (shouldVerify.toLowerCase() === 'y') {
      console.log("\n🔍 验证迁移结果...");
      
      try {
        // 检查提案数量
        if (newContract.getProposalCount) {
          const proposalCount = await newContract.getProposalCount();
          console.log(`✅ 新合约提案数量: ${proposalCount}`);
          
          if (exportData.data.proposals) {
            const expectedCount = exportData.data.proposals.length;
            if (proposalCount.toString() === expectedCount.toString()) {
              console.log(`✅ 提案数量匹配 (${expectedCount})`);
            } else {
              console.log(`⚠️  提案数量不匹配: 期望 ${expectedCount}, 实际 ${proposalCount}`);
            }
          }
        }
        
        // 检查第一个提案
        if (exportData.data.proposals && exportData.data.proposals.length > 0) {
          try {
            const firstProposal = await newContract.getProposal(0);
            const expectedDescription = exportData.data.proposals[0].description;
            
            if (firstProposal[0] === expectedDescription || firstProposal.description === expectedDescription) {
              console.log(`✅ 第一个提案内容匹配`);
            } else {
              console.log(`⚠️  第一个提案内容不匹配`);
            }
          } catch (error) {
            console.log(`⚠️  无法验证提案内容: ${error.message}`);
          }
        }
        
      } catch (error) {
        console.log(`❌ 验证失败: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error("❌ 迁移失败:", error.message);
  } finally {
    rl.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { migrateData };