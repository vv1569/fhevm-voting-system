/**
 * Configuration Management Module
 * Handles application configuration loading, validation and management
 */

class ConfigManager {
    constructor() {
        this.config = null;
        this.isLoaded = false;
        this.defaultConfig = {
            chainId: '1337',
            rpcUrl: 'http://localhost:8545',
            gatewayUrl: 'http://localhost:7077',
            contractAddress: '',
            networkName: 'Local Network',
            blockExplorer: '',
            retryAttempts: 3,
            retryDelay: 1000,
            requestTimeout: 30000
        };
    }

    /**
     * Load configuration
     * @returns {Promise<Object>} Configuration object
     */
    async loadConfig() {
        try {
            console.log('Loading application configuration...');
            
            // Try to load configuration from server
            const serverConfig = await this.loadServerConfig();
            
            // Merge default configuration and server configuration
            this.config = { ...this.defaultConfig, ...serverConfig };
            
            // Validate configuration
            this.validateConfig();
            
            // Set global configuration
            window.appConfig = this.config;
            
            this.isLoaded = true;
            console.log('Configuration loaded successfully:', this.config);
            
            return this.config;
        } catch (error) {
            console.warn('Configuration loading failed, using default configuration:', error);
            
            // Use default configuration
            this.config = { ...this.defaultConfig };
            window.appConfig = this.config;
            this.isLoaded = true;
            
            return this.config;
        }
    }

    /**
     * Load configuration from server
     * @returns {Promise<Object>} Server configuration
     */
    async loadServerConfig() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.defaultConfig.requestTimeout);
        
        try {
            const response = await fetch('/config.json', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const config = await response.json();
            console.log('Server configuration loaded successfully');
            
            return config;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Configuration loading timeout');
            }
            
            throw error;
        }
    }

    /**
     * Validate configuration
     */
    validateConfig() {
        const required = ['chainId', 'rpcUrl', 'contractAddress'];
        const missing = required.filter(key => !this.config[key]);
        
        if (missing.length > 0) {
            console.warn('Missing required configuration items:', missing);
        }
        
        // Validate URL format
        if (this.config.rpcUrl && !this.isValidUrl(this.config.rpcUrl)) {
            console.warn('Invalid RPC URL format:', this.config.rpcUrl);
        }
        
        if (this.config.gatewayUrl && !this.isValidUrl(this.config.gatewayUrl)) {
            console.warn('Invalid Gateway URL format:', this.config.gatewayUrl);
        }
        
        // Validate contract address
        if (this.config.contractAddress && !this.isValidAddress(this.config.contractAddress)) {
            console.warn('Invalid contract address format:', this.config.contractAddress);
        }
    }

    /**
     * Validate URL format
     * @param {string} url URL string
     * @returns {boolean} Whether valid
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate Ethereum address format
     * @param {string} address Address string
     * @returns {boolean} Whether valid
     */
    isValidAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    /**
     * Get configuration value
     * @param {string} key Configuration key
     * @param {*} defaultValue Default value
     * @returns {*} Configuration value
     */
    get(key, defaultValue = null) {
        if (!this.isLoaded) {
            console.warn('Configuration not yet loaded');
            return defaultValue;
        }
        
        return this.config[key] ?? defaultValue;
    }

    /**
     * Set configuration value
     * @param {string} key Configuration key
     * @param {*} value Configuration value
     */
    set(key, value) {
        if (!this.config) {
            this.config = {};
        }
        
        this.config[key] = value;
        
        // Update global configuration
        if (window.appConfig) {
            window.appConfig[key] = value;
        }
    }

    /**
     * Get network configuration
     * @returns {Object} Network configuration
     */
    getNetworkConfig() {
        return {
            chainId: this.get('chainId'),
            rpcUrl: this.get('rpcUrl'),
            networkName: this.get('networkName'),
            blockExplorer: this.get('blockExplorer')
        };
    }

    /**
     * Get contract configuration
     * @returns {Object} Contract configuration
     */
    getContractConfig() {
        return {
            address: this.get('contractAddress'),
            abi: this.get('abi', [])
        };
    }

    /**
     * Get FHEVM configuration
     * @returns {Object} FHEVM configuration
     */
    getFHEVMConfig() {
        return {
            chainId: parseInt(this.get('chainId')),
            networkUrl: this.get('rpcUrl'),
            gatewayUrl: this.get('gatewayUrl')
        };
    }

    /**
     * Get retry configuration
     * @returns {Object} Retry configuration
     */
    getRetryConfig() {
        return {
            attempts: this.get('retryAttempts'),
            delay: this.get('retryDelay')
        };
    }

    /**
     * Check if development environment
     * @returns {boolean} Whether development environment
     */
    isDevelopment() {
        return this.get('environment') === 'development' || 
               this.get('rpcUrl', '').includes('localhost') ||
               this.get('chainId') === '1337';
    }

    /**
     * Check if testnet
     * @returns {boolean} Whether testnet
     */
    isTestnet() {
        const testnetChainIds = ['3', '4', '5', '42', '11155111']; // Ropsten, Rinkeby, Goerli, Kovan, Sepolia
        return testnetChainIds.includes(this.get('chainId'));
    }

    /**
     * Check if mainnet
     * @returns {boolean} Whether mainnet
     */
    isMainnet() {
        return this.get('chainId') === '1';
    }

    /**
     * Get environment information
     * @returns {Object} Environment information
     */
    getEnvironmentInfo() {
        return {
            isDevelopment: this.isDevelopment(),
            isTestnet: this.isTestnet(),
            isMainnet: this.isMainnet(),
            chainId: this.get('chainId'),
            networkName: this.get('networkName')
        };
    }

    /**
     * Reload configuration
     * @returns {Promise<Object>} New configuration
     */
    async reload() {
        this.isLoaded = false;
        this.config = null;
        return await this.loadConfig();
    }

    /**
     * Export configuration
     * @returns {Object} Configuration copy
     */
    export() {
        return { ...this.config };
    }

    /**
     * Reset to default configuration
     */
    reset() {
        this.config = { ...this.defaultConfig };
        window.appConfig = this.config;
        console.log('Configuration reset to default values');
    }

    /**
     * Get configuration status
     * @returns {Object} Configuration status
     */
    getStatus() {
        return {
            isLoaded: this.isLoaded,
            hasConfig: !!this.config,
            configKeys: this.config ? Object.keys(this.config) : [],
            environment: this.getEnvironmentInfo()
        };
    }

    /**
     * Validate required configuration
     * @param {Array<string>} requiredKeys Required configuration keys
     * @returns {Object} Validation result
     */
    validateRequired(requiredKeys = []) {
        const missing = [];
        const invalid = [];
        
        requiredKeys.forEach(key => {
            const value = this.get(key);
            
            if (!value) {
                missing.push(key);
            } else {
                // Special validation
                if (key === 'contractAddress' && !this.isValidAddress(value)) {
                    invalid.push(key);
                } else if ((key === 'rpcUrl' || key === 'gatewayUrl') && !this.isValidUrl(value)) {
                    invalid.push(key);
                }
            }
        });
        
        return {
            isValid: missing.length === 0 && invalid.length === 0,
            missing,
            invalid
        };
    }

    /**
     * Get debug information
     * @returns {Object} Debug information
     */
    getDebugInfo() {
        return {
            status: this.getStatus(),
            config: this.config,
            defaultConfig: this.defaultConfig,
            validation: this.validateRequired(['chainId', 'rpcUrl', 'contractAddress'])
        };
    }
}

// Export singleton instance
window.configManager = new ConfigManager();

// Backward-compatible global functions
window.loadConfig = async () => {
    return await window.configManager.loadConfig();
};