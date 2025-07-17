const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("\n=== 账户余额检查 ===");
  console.log("账户地址:", deployer.address);
  
  const balance = await deployer.getBalance();
  const balanceInEth = ethers.utils.formatEther(balance);
  
  console.log("账户余额:", balanceInEth, "ETH");
  
  // 检查网络信息
  const network = await ethers.provider.getNetwork();
  console.log("网络名称:", network.name);
  console.log("链 ID:", network.chainId);
  
  // 检查 Gas 价格
  const gasPrice = await ethers.provider.getGasPrice();
  const gasPriceInGwei = ethers.utils.formatUnits(gasPrice, "gwei");
  console.log("当前 Gas 价格:", gasPriceInGwei, "Gwei");
  
  // 估算部署成本
  const estimatedGasForDeploy = 2000000; // 估算的部署 Gas
  const estimatedCost = gasPrice.mul(estimatedGasForDeploy);
  const estimatedCostInEth = ethers.utils.formatEther(estimatedCost);
  
  console.log("\n=== 部署成本估算 ===");
  console.log("估算 Gas 用量:", estimatedGasForDeploy.toLocaleString());
  console.log("估算部署成本:", estimatedCostInEth, "ETH");
  
  // 检查余额是否足够
  const hasEnoughBalance = balance.gt(estimatedCost.mul(2)); // 留出2倍余量
  console.log("余额是否充足:", hasEnoughBalance ? "✅ 是" : "❌ 否");
  
  if (!hasEnoughBalance) {
    console.log("\n⚠️  警告: 账户余额可能不足以完成部署");
    console.log("建议最少余额:", ethers.utils.formatEther(estimatedCost.mul(2)), "ETH");
    
    if (network.chainId === 11155111) { // Sepolia
      console.log("\n💡 获取 Sepolia 测试网 ETH:");
      console.log("- https://sepoliafaucet.com/");
      console.log("- https://faucet.sepolia.dev/");
    }
  }
  
  console.log("\n=== 检查完成 ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("检查失败:", error);
    process.exit(1);
  });