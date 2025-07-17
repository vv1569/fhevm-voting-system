/**
 * Wallet Management Module
 * Handles wallet connection, state management and user authentication
 */

class WalletManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.isOwner = false;
        this.connectionTimeout = 30000; // 30 second timeout
    }

    /**
     * Connect wallet
     * @returns {Promise<boolean>} Whether connection was successful
     */
    async connect() {
        const connectBtn = document.getElementById('connectWallet');
        
        try {
            console.log('Starting wallet connection...');
            
            // Update button state
            this.updateButtonState(connectBtn, 'connecting');
            
            // Check if MetaMask is installed
            if (!this.isMetaMaskInstalled()) {
                throw new Error('Please install MetaMask wallet');
            }

            // Set connection timeout
            const connectionPromise = this.requestAccounts();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout)
            );

            await Promise.race([connectionPromise, timeoutPromise]);
            
            // Initialize provider and signer
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            this.userAddress = await this.signer.getAddress();
            
            console.log('Wallet connected successfully, user address:', this.userAddress);
            
            // Validate network
            await this.validateNetwork();
            
            // Re-initialize provider after network switch
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            
            // Update UI
            this.updateWalletUI();
            
            // Set up event listeners
            this.setupEventListeners();
            
            return true;
            
        } catch (error) {
            console.error('Wallet connection failed:', error);
            this.handleConnectionError(error);
            return false;
        } finally {
            this.updateButtonState(connectBtn, 'normal');
        }
    }

    /**
     * Check if MetaMask is installed
     */
    isMetaMaskInstalled() {
        return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
    }

    /**
     * Request account access permission
     */
    async requestAccounts() {
        return await window.ethereum.request({ method: 'eth_requestAccounts' });
    }

    /**
     * Validate network configuration
     */
    async validateNetwork() {
        const network = await this.provider.getNetwork();
        const expectedChainId = parseInt(window.appConfig?.chainId || '1337');
        
        if (network.chainId !== expectedChainId) {
            console.warn(`Network mismatch: current ${network.chainId}, expected ${expectedChainId}`);
            
            // Try to auto-switch to local network
            try {
                await this.switchToLocalNetwork(expectedChainId);
            } catch (error) {
                console.error('Network switch failed:', error);
                throw new Error(`Please manually switch to local network (Chain ID: ${expectedChainId})`);
            }
        }
    }

    /**
     * Switch to local network
     */
    async switchToLocalNetwork(chainId) {
        const chainIdHex = '0x' + chainId.toString(16);
        
        try {
            // Try to switch network
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainIdHex }],
            });
        } catch (switchError) {
            // If network doesn't exist, try to add network
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: chainIdHex,
                        chainName: 'Hardhat Local',
                        nativeCurrency: {
                            name: 'ETH',
                            symbol: 'ETH',
                            decimals: 18
                        },
                        rpcUrls: [window.appConfig?.rpcUrl || 'http://localhost:8545'],
                        blockExplorerUrls: null
                    }]
                });
            } else {
                throw switchError;
            }
        }
    }

    /**
     * Update button state
     */
    updateButtonState(button, state) {
        switch (state) {
            case 'connecting':
                button.classList.add('connecting');
                button.textContent = 'Connecting...';
                button.disabled = true;
                break;
            case 'connected':
                button.classList.remove('connecting');
                button.textContent = 'Connected';
                button.disabled = true;
                break;
            case 'normal':
            default:
                button.classList.remove('connecting');
                button.textContent = 'Connect Wallet';
                button.disabled = false;
                break;
        }
    }

    /**
     * Update wallet UI display
     */
    updateWalletUI() {
        const connectBtn = document.getElementById('connectWallet');
        const addressSpan = document.getElementById('walletAddress');
        
        if (this.userAddress) {
            this.updateButtonState(connectBtn, 'connected');
            if (addressSpan) {
                addressSpan.textContent = this.formatAddress(this.userAddress);
                addressSpan.classList.remove('hidden');
            }
        }
    }

    /**
     * Format address display
     */
    formatAddress(address) {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Handle connection errors
     */
    handleConnectionError(error) {
        let message = 'Wallet connection failed';
        
        if (error.message.includes('User rejected')) {
            message = 'User rejected the connection request';
        } else if (error.message.includes('timeout')) {
            message = 'Connection timeout, please try again';
        } else if (error.message.includes('MetaMask')) {
            message = 'Please install and enable MetaMask wallet';
        }
        
        window.showStatus?.(message, 'error');
    }

    /**
     * Set up wallet event listeners
     */
    setupEventListeners() {
        if (window.ethereum) {
            // Listen for account changes
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnect();
                } else {
                    location.reload(); // Simple reload, can be optimized for partial updates
                }
            });

            // Listen for network changes
            window.ethereum.on('chainChanged', () => {
                location.reload();
            });
        }
    }

    /**
     * Disconnect wallet
     */
    disconnect() {
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.isOwner = false;
        
        // Reset UI
        const connectBtn = document.getElementById('connectWallet');
        const addressSpan = document.getElementById('walletAddress');
        
        this.updateButtonState(connectBtn, 'normal');
        if (addressSpan) {
            addressSpan.classList.add('hidden');
        }
        
        window.showStatus?.('Wallet disconnected', 'info');
    }

    /**
     * Get current connection status
     */
    isConnected() {
        return !!(this.provider && this.signer && this.userAddress);
    }

    /**
     * Get user address
     */
    getAddress() {
        return this.userAddress;
    }

    /**
     * Get signer
     */
    getSigner() {
        return this.signer;
    }

    /**
     * Get provider
     */
    getProvider() {
        return this.provider;
    }
}

// Export singleton instance
window.walletManager = new WalletManager();