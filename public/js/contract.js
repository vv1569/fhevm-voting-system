/**
 * Contract Management Module
 * Handles smart contract interactions, FHEVM integration and voting logic
 */

class ContractManager {
    constructor() {
        this.contract = null;
        this.fhevmInstance = null;
        this.contractAddress = null;
        this.abi = null;
        this.isInitialized = false;
        this.useMockFHEVM = false;
    }

    /**
     * Initialize contract manager
     * @param {Object} config Configuration object
     */
    async initialize(config) {
        try {
            console.log('Initializing contract manager...');
            
            this.contractAddress = config.contractAddress;
            this.abi = config.abi;
            
            // Initialize FHEVM
            await this.initializeFHEVM();
            
            // Initialize contract instance
            await this.initializeContract();
            
            this.isInitialized = true;
            console.log('Contract manager initialized successfully');
            
        } catch (error) {
            console.error('Contract manager initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize FHEVM instance
     */
    async initializeFHEVM() {
        try {
            if (typeof fhevm !== 'undefined') {
                console.log('Initializing FHEVM instance...');
                this.fhevmInstance = await fhevm.createInstance({
                    chainId: parseInt(window.appConfig?.chainId || '1337'),
                    networkUrl: window.appConfig?.rpcUrl || 'http://localhost:8545',
                    gatewayUrl: window.appConfig?.gatewayUrl || 'http://localhost:7077'
                });
                console.log('FHEVM instance created successfully');
            } else {
                console.warn('FHEVM library not loaded, using mock instance');
                this.createMockFHEVM();
            }
        } catch (error) {
            console.warn('FHEVM initialization failed, using mock instance:', error);
            this.createMockFHEVM();
        }
    }

    /**
     * Create FHEVM mock instance
     */
    createMockFHEVM() {
        this.useMockFHEVM = true;
        this.fhevmInstance = {
            encrypt32: (value) => {
                console.log('Mock encryption:', value);
                return Promise.resolve(new Uint8Array(32).fill(value % 256));
            },
            decrypt: (encryptedValue) => {
                console.log('Mock decryption:', encryptedValue);
                return Promise.resolve(Math.floor(Math.random() * 100));
            },
            generateKeypair: () => {
                console.log('Mock key pair generation');
                return {
                    publicKey: new Uint8Array(32).fill(1),
                    privateKey: new Uint8Array(32).fill(2)
                };
            }
        };
    }

    /**
     * Initialize contract instance
     */
    async initializeContract() {
        if (!window.walletManager?.isConnected()) {
            throw new Error('Wallet not connected');
        }

        const signer = window.walletManager.getSigner();
        this.contract = new ethers.Contract(this.contractAddress, this.abi, signer);
        
        // Verify contract exists
        await this.validateContract();
    }

    /**
     * Verify if contract exists
     */
    async validateContract() {
        try {
            console.log('Verifying contract address:', this.contractAddress);
            const provider = window.walletManager.getProvider();
            const network = await provider.getNetwork();
            console.log('Current network:', network.chainId, network.name);
            
            const code = await provider.getCode(this.contractAddress);
            console.log('Contract code length:', code.length);
            
            if (code === '0x') {
                throw new Error('Invalid contract address or contract not deployed');
            }
            
            console.log('Contract verification successful');
        } catch (error) {
            console.error('Contract verification failed:', error);
            throw error;
        }
    }

    /**
     * Check user role
     * @returns {Promise<Object>} User role information
     */
    async checkUserRole() {
        if (!this.isInitialized) {
            throw new Error('Contract manager not initialized');
        }

        try {
            const userAddress = window.walletManager.getAddress();
            
            // Check if user is owner
            const owner = await this.contract.owner();
            const isOwner = owner.toLowerCase() === userAddress.toLowerCase();
            
            // Check if user is authorized voter
            const isAuthorizedVoter = await this.contract.authorizedVoters(userAddress);
            
            return {
                isOwner,
                isAuthorizedVoter,
                address: userAddress
            };
        } catch (error) {
            console.error('Failed to check user role:', error);
            throw error;
        }
    }

    /**
     * Add authorized voter
     * @param {string} voterAddress Voter address
     */
    async addVoter(voterAddress) {
        if (!this.isInitialized) {
            throw new Error('Contract manager not initialized');
        }

        try {
            console.log('Adding voter:', voterAddress);
            
            // Validate address format
             if (!ethers.utils.isAddress(voterAddress)) {
                 throw new Error('Invalid address format');
             }

            const tx = await this.contract.addAuthorizedVoter(voterAddress);
            console.log('Transaction submitted:', tx.hash);

             // Wait for transaction confirmation
             const receipt = await tx.wait();
             console.log('Transaction confirmed:', receipt.transactionHash);
            
            return receipt;
        } catch (error) {
            console.error('Failed to add voter:', error);
            this.handleContractError(error);
            throw error;
        }
    }

    /**
     * Create proposal
     * @param {string} description Proposal description
     * @param {number} duration Voting duration (seconds)
     */
    async createProposal(description, duration) {
        if (!this.isInitialized) {
            throw new Error('Contract manager not initialized');
        }

        try {
            console.log('Creating proposal:', description, 'Duration:', duration);
            
            const tx = await this.contract.createProposal(description, duration);
            console.log('Transaction submitted:', tx.hash);

             const receipt = await tx.wait();
             console.log('Transaction confirmed:', receipt.transactionHash);
            
            return receipt;
        } catch (error) {
            console.error('Failed to create proposal:', error);
            this.handleContractError(error);
            throw error;
        }
    }

    /**
     * Vote
     * @param {number} proposalId Proposal ID
     * @param {boolean} support Whether to support
     */
    async vote(proposalId, support) {
        if (!this.isInitialized) {
            throw new Error('Contract manager not initialized');
        }

        try {
            console.log('Voting:', proposalId, support ? 'Support' : 'Oppose');
            
            // Encrypt vote
            const encryptedVote = await this.encryptVote(support ? 1 : 0);
            
            const tx = await this.contract.vote(proposalId, encryptedVote);
            console.log('Vote transaction submitted:', tx.hash);
            
            const receipt = await tx.wait();
            console.log('Vote transaction confirmed:', receipt.transactionHash);
            
            return receipt;
        } catch (error) {
            console.error('Failed to vote:', error);
            this.handleContractError(error);
            throw error;
        }
    }

    /**
     * Encrypt vote
     * @param {number} vote Vote value (0 or 1)
     */
    async encryptVote(vote) {
        try {
            if (this.useMockFHEVM) {
                console.log('Using mock encryption');
                return await this.fhevmInstance.encrypt32(vote);
            } else {
                return await this.fhevmInstance.encrypt32(vote);
            }
        } catch (error) {
            console.error('Failed to encrypt vote:', error);
            throw error;
        }
    }

    /**
     * Get proposal list
     * @returns {Promise<Array>} Proposal list
     */
    async getProposals() {
        if (!this.isInitialized) {
            throw new Error('Contract manager not initialized');
        }

        try {
            const proposalCount = await this.contract.proposalCount();
            const proposals = [];
            
            for (let i = 0; i < proposalCount; i++) {
                const proposal = await this.contract.proposals(i);
                proposals.push({
                    id: i,
                    description: proposal.description,
                    endTime: proposal.endTime.toNumber(),
                    isActive: proposal.isActive,
                    creator: proposal.creator
                });
            }
            
            return proposals;
        } catch (error) {
            console.error('Failed to get proposal list:', error);
            throw error;
        }
    }

    /**
     * Handle contract error
     * @param {Error} error Error object
     */
    handleContractError(error) {
        let message = 'Contract operation failed';
        
        if (error.message.includes('user rejected')) {
            message = 'User cancelled transaction';
        } else if (error.message.includes('insufficient funds')) {
            message = 'Insufficient balance';
        } else if (error.message.includes('gas')) {
            message = 'Insufficient gas fee';
        } else if (error.message.includes('revert')) {
            message = 'Transaction reverted, please check operation conditions';
        }
        
        window.showStatus?.(message, 'error');
    }

    /**
     * Get contract instance
     */
    getContract() {
        return this.contract;
    }

    /**
     * Get FHEVM instance
     */
    getFHEVMInstance() {
        return this.fhevmInstance;
    }

    /**
     * Check if initialized
     */
    isReady() {
        return this.isInitialized;
    }
}

// Export singleton instance
window.contractManager = new ContractManager();