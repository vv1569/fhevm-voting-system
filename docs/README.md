# FHEVM Voting System

一个基于全同态加密（FHE）的隐私保护投票系统，使用 ZAMA 的 FHEVM 技术确保投票过程的完全隐私性。

## 🌟 特性

- **完全隐私保护**: 使用全同态加密技术，投票内容在整个过程中保持加密状态
- **去中心化**: 基于以太坊智能合约的去中心化投票系统
- **现代化界面**: 响应式设计，支持移动端和桌面端
- **模块化架构**: 清晰的代码结构，易于维护和扩展
- **实时状态**: 实时显示投票状态和统计信息
- **测试模式**: 内置测试数据，便于演示和开发

## 🏗️ 技术栈

### 前端
- **HTML5/CSS3**: 现代化的用户界面
- **JavaScript (ES6+)**: 模块化的前端逻辑
- **Ethers.js**: 以太坊区块链交互
- **FHEVM.js**: 全同态加密功能

### 后端
- **Node.js**: 服务器运行环境
- **Express.js**: Web 应用框架
- **Solidity**: 智能合约开发语言
- **Hardhat**: 开发和测试框架

### 区块链
- **FHEVM**: ZAMA 的全同态加密虚拟机
- **Ethereum**: 底层区块链网络
- **MetaMask**: 钱包连接

## 📁 项目结构

```
机密投票系统/
├── contracts/                 # 智能合约
│   └── VotingSystem.sol      # 主投票合约
├── public/                   # 前端资源
│   ├── css/
│   │   └── styles.css        # 样式文件
│   ├── js/                   # JavaScript 模块
│   │   ├── app.js           # 主应用控制器
│   │   ├── config.js        # 配置管理
│   │   ├── contract.js      # 合约交互
│   │   ├── ui.js            # UI 管理
│   │   └── wallet.js        # 钱包管理
│   └── index.html           # 主页面
├── scripts/                  # 部署和工具脚本
│   ├── deploy.js            # 合约部署
│   ├── check-balance.js     # 余额检查
│   ├── analyze-existing.js  # 合约分析
│   ├── export-data.js       # 数据导出
│   └── migrate-data.js      # 数据迁移
├── test/                     # 测试文件
│   └── VotingSystem.test.js # 合约测试
├── docs/                     # 文档
│   └── README.md            # 项目文档
├── server.js                # Express 服务器
├── hardhat.config.js        # Hardhat 配置
└── package.json             # 项目依赖
```

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- MetaMask 浏览器扩展
- Git

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd 机密投票系统
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **环境配置**
   ```bash
   # 复制环境变量模板
   cp .env.example .env
   
   # 编辑 .env 文件，添加必要的配置
   # PRIVATE_KEY=your_private_key
   # ETHERSCAN_API_KEY=your_etherscan_api_key
   ```

4. **启动本地区块链**
   ```bash
   npx hardhat node
   ```

5. **部署合约**
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

6. **启动应用**
   ```bash
   npm start
   ```

7. **访问应用**
   打开浏览器访问 `http://localhost:3000`

## 📖 使用指南

### 管理员功能

1. **连接钱包**: 点击"Connect Wallet"按钮连接 MetaMask
2. **添加投票者**: 在管理员面板中添加授权投票者
3. **创建提案**: 创建新的投票提案
4. **管理投票**: 监控投票进度和结果

### 投票者功能

1. **连接钱包**: 连接已授权的钱包地址
2. **查看提案**: 浏览可用的投票提案
3. **参与投票**: 对感兴趣的提案进行投票
4. **查看结果**: 查看投票统计和结果

### 测试模式

系统提供测试模式，无需连接真实区块链即可体验功能：

1. 点击"Load Test Data"加载测试提案
2. 在测试提案上进行模拟投票
3. 查看投票统计和结果
4. 点击"Clear Test Data"清除测试数据

## 🔧 开发指南

### 代码结构

#### 前端模块

- **app.js**: 主应用控制器，负责整体应用的初始化和协调
- **config.js**: 配置管理模块，处理应用配置的加载和验证
- **wallet.js**: 钱包管理模块，处理钱包连接、状态管理和事件监听
- **contract.js**: 合约交互模块，封装所有智能合约相关操作
- **ui.js**: UI管理模块，处理用户界面更新和交互

#### 智能合约

- **VotingSystem.sol**: 主投票合约，实现投票逻辑和权限管理

### 开发命令

```bash
# 编译合约
npm run compile

# 运行测试
npm test

# 生成测试覆盖率报告
npm run coverage

# 代码格式化
npm run format

# 代码检查
npm run lint

# 启动开发服务器
npm run dev
```

### 测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npx hardhat test test/VotingSystem.test.js

# 生成覆盖率报告
npm run coverage
```

## 🔐 安全考虑

### 隐私保护

- 所有投票数据使用 FHE 加密
- 投票内容在链上保持加密状态
- 只有授权用户可以参与投票

### 智能合约安全

- 使用 OpenZeppelin 安全库
- 实施访问控制机制
- 防止重入攻击
- 输入验证和边界检查

### 前端安全

- CSP (Content Security Policy) 配置
- XSS 防护
- 安全的外部资源加载
- 错误处理和日志记录

## 🌐 部署

### 测试网部署

1. **配置网络**
   ```javascript
   // hardhat.config.js
   networks: {
     sepolia: {
       url: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
       accounts: [process.env.PRIVATE_KEY]
     }
   }
   ```

2. **部署合约**
   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```

3. **验证合约**
   ```bash
   npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
   ```

### 主网部署

⚠️ **警告**: 主网部署前请确保：
- 完整的安全审计
- 充分的测试覆盖
- 备份和恢复计划
- 监控和告警系统

## 📊 API 文档

### REST API

#### 健康检查
```
GET /api/health
```
返回服务器状态信息。

#### 获取配置
```
GET /config.json
```
返回应用配置信息。

#### 获取部署信息
```
GET /api/deployments
```
返回合约部署信息。

### 智能合约 API

#### 管理员功能

- `addAuthorizedVoter(address voter, bytes32 encryptedVotingPower, bytes calldata inputProof)`
- `createProposal(string memory title, string memory description, uint256 votingDuration)`

#### 投票功能

- `vote(uint256 proposalId, bytes32 encryptedVote, bytes calldata inputProof)`
- `getProposal(uint256 proposalId)`
- `getVotingStats(uint256 proposalId)`

#### 查询功能

- `isAuthorizedVoter(address voter)`
- `hasVoted(uint256 proposalId, address voter)`
- `proposalCount()`

## 🤝 贡献指南

### 贡献流程

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 代码规范

- 使用 ESLint 进行代码检查
- 遵循 Prettier 代码格式化规则
- 编写清晰的注释和文档
- 为新功能添加测试

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` 错误修复
- `docs:` 文档更新
- `style:` 代码格式化
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建过程或辅助工具的变动

## 🐛 问题排查

### 常见问题

1. **钱包连接失败**
   - 确保安装了 MetaMask
   - 检查网络配置
   - 刷新页面重试

2. **合约交互失败**
   - 检查合约地址配置
   - 确认账户有足够的 Gas
   - 验证网络连接

3. **FHEVM 初始化失败**
   - 检查 FHEVM 库加载
   - 使用测试模式进行调试
   - 查看浏览器控制台错误

### 调试技巧

- 使用浏览器开发者工具
- 检查控制台日志
- 使用 Hardhat 本地网络进行测试
- 启用详细日志记录

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [ZAMA](https://www.zama.ai/) - 提供 FHEVM 技术
- [OpenZeppelin](https://openzeppelin.com/) - 智能合约安全库
- [Hardhat](https://hardhat.org/) - 开发框架
- [Ethers.js](https://ethers.org/) - 以太坊库

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 创建 [Issue](../../issues)
- 发送邮件至: [your-email@example.com]
- 加入我们的 [Discord](https://discord.gg/your-server)

---

**注意**: 这是一个演示项目，用于展示 FHEVM 技术的应用。在生产环境中使用前，请进行充分的安全审计和测试。