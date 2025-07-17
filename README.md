# FHEVM Confidential Voting System

[![FHEVM](https://img.shields.io/badge/FHEVM-Powered-blue)](https://github.com/zama-ai/fhevm)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.19-green)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-Framework-yellow)](https://hardhat.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen)](https://nodejs.org/)

A confidential voting system based on FHEVM (Fully Homomorphic Encryption Virtual Machine), providing completely privacy-protected on-chain voting solutions.

## 🌟 Key Features

- **Complete Privacy Protection**: Based on TFHE fully homomorphic encryption technology, ensuring completely confidential voting process
- **On-chain Governance**: Decentralized proposal creation and voting mechanism
- **Real-time Statistics**: Vote counting and result announcement in encrypted state
- **Permission Management**: Flexible voter authorization and weight allocation
- **Security & Reliability**: Thoroughly tested smart contracts

## 🚀 Quick Start

### Requirements

- Node.js >= 18.0.0
- NPM >= 8.0.0
- Git
- MetaMask Wallet

### Install Dependencies

```bash
npm install
```

### Environment Configuration

```bash
cp .env.example .env
# Edit the .env file and fill in the necessary configuration information
```

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm test
```

### Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000 to view the voting system interface.

## 📁 Project Structure

```
voting-system/
├── contracts/           # Smart contracts
│   └── VotingSystem.sol # Main voting system contract
├── scripts/            # Deployment scripts
│   └── deploy.js       # Contract deployment script
├── test/               # Test files
│   └── VotingSystem.test.js # Voting system tests
├── public/             # Frontend files
│   └── index.html      # Voting interface
├── hardhat.config.js   # Hardhat configuration
├── package.json        # Project dependencies
├── server.js          # Express server
└── .env.example       # Environment variables template
```

## 🔧 Core Features

### Voting Management
- Create proposals
- Set voting deadlines
- Voter authorization
- Weight allocation

### Privacy Voting
- Encrypted vote choices
- Hidden voting results
- Prevent vote manipulation
- Anonymous statistics

### Result Announcement
- Publish results after voting period ends
- Transparent counting process
- Verifiable results

## 📚 API Documentation

### Smart Contract Interface

```solidity
// Create proposal
function createProposal(
    string memory title,
    string memory description,
    uint256 duration
) external returns (uint256)

// Vote
function vote(
    uint256 proposalId,
    einput encryptedChoice,
    bytes calldata inputProof
) external

// Authorize voter
function authorizeVoter(
    address voter,
    einput encryptedPower,
    bytes calldata inputProof
) external
```

### REST API

```javascript
// Health check
GET /api/health

// Get configuration
GET /config.json

// Get deployment info
GET /api/deployments
```

## 🧪 Testing

Run the complete test suite:

```bash
npm test
```

Generate coverage report:

```bash
npm run coverage
```

## 🚀 Deployment

### Local Deployment

```bash
# Start local node
npx hardhat node

# Deploy contracts
npm run deploy:local
```

### Testnet Deployment

```bash
# Deploy to Sepolia testnet
npm run deploy:sepolia
```

## 🔒 Security Considerations

- Use TFHE encryption to protect voting privacy
- Implement access control and permission management
- Prevent duplicate voting and malicious attacks
- Regular security audits

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Zama](https://zama.ai/) - FHEVM and TFHE technology
- [Hardhat](https://hardhat.org/) - Development framework
- [OpenZeppelin](https://openzeppelin.com/) - Secure contract library

## 📞 Contact Us

- Project Homepage: [GitHub Repository](https://github.com/your-username/fhevm-voting-system)
- Issue Reports: [Issues](https://github.com/your-username/fhevm-voting-system/issues)
- Email: your-email@example.com