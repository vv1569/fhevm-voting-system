/**
 * Application Main Controller
 * Integrates all modules and provides unified application management interface
 */

class AppController {
    constructor() {
        this.isInitialized = false;
        this.modules = {
            config: null,
            wallet: null,
            contract: null,
            ui: null
        };
        
        // Initialize optimization modules
        this.stateManager = window.stateManager;
        this.errorHandler = window.errorHandler;
        this.performanceOptimizer = window.performanceOptimizer;
        this.typeValidator = window.typeValidator;
        this.cacheManager = window.cacheManager;
        
        this.state = {
            isConnected: false,
            userInfo: null,
            proposals: [],
            lastUpdate: null
        };
        this.eventListeners = new Map();
        
        // Subscribe to state changes
        if (this.stateManager) {
            this.stateManager.subscribe((state, action) => {
                this.handleStateChange(state, action);
            });
        }
        
        // Setup performance monitoring
        if (this.performanceOptimizer) {
            this.performanceOptimizer.startMonitoring();
        }
    }

    /**
     * Initialize application
     */
    async initialize() {
        try {
            console.log('🚀 FHEVM Voting System initialization started');
            
            // Show initialization status
            this.showInitStatus('Initializing system...');
            
            // Update state
            if (this.stateManager) {
                this.stateManager.dispatch({
                    type: 'SET_LOADING',
                    payload: { loading: true, message: 'Initializing system...' }
                });
            }
            
            // 1. Initialize module references
            this.initializeModuleReferences();
            
            // 2. Initialize UI manager
            this.modules.ui.initialize();
            
            // 3. Load configuration
            await this.initializeConfig();
            
            // 4. Set up global error handling
            this.setupGlobalErrorHandling();
            
            // 5. Initialize event system
            this.initializeEventSystem();
            
            // 6. Try auto-connect wallet (if previously connected)
            await this.tryAutoConnect();
            
            // 7. Load initial data
            await this.loadInitialData();
            
            this.isInitialized = true;
            this.showInitStatus('System initialization completed', 'success');
            
            // Update state
            if (this.stateManager) {
                this.stateManager.dispatch({
                    type: 'SET_INITIALIZED',
                    payload: { isInitialized: true }
                });
                
                this.stateManager.dispatch({
                    type: 'SET_LOADING',
                    payload: { loading: false }
                });
            }
            
            // Set global variables for HTML functions
            window.appController = this;
            
            console.log('✅ All modules initialized successfully');
            
        } catch (error) {
            console.error('❌ Application initialization failed:', error);
            this.showInitStatus('System initialization failed', 'error');
            
            // Handle error with error handler
            if (this.errorHandler) {
                this.errorHandler.handleError(error, {
                    context: 'Application initialization',
                    severity: 'high',
                    userMessage: 'Failed to initialize application. Please refresh the page.'
                });
            }
            
            // Update state
            if (this.stateManager) {
                this.stateManager.dispatch({
                    type: 'SET_ERROR',
                    payload: { error: error.message, context: 'initialization' }
                });
            }
            
            // Ensure basic functionality is available even if initialization fails
            this.isInitialized = true;
        }
    }

    /**
     * Initialize module references
     */
    initializeModuleReferences() {
        this.modules.config = window.configManager;
        this.modules.wallet = window.walletManager;
        this.modules.contract = window.contractManager;
        this.modules.ui = window.uiManager;
        
        // Validate modules are loaded correctly
        const missingModules = Object.entries(this.modules)
            .filter(([name, module]) => !module)
            .map(([name]) => name);
            
        if (missingModules.length > 0) {
            console.warn('The following modules failed to load:', missingModules);
        }
    }

    /**
     * Initialize configuration
     */
    async initializeConfig() {
        try {
            // Try to get config from cache first
            let config;
            if (this.cacheManager) {
                const cachedConfig = this.cacheManager.get('app_config');
                if (cachedConfig) {
                    config = cachedConfig;
                    console.log('Configuration loaded from cache');
                } else {
                    config = await this.modules.config.loadConfig();
                    // Cache configuration for 30 minutes
                    this.cacheManager.set('app_config', config, { ttl: 30 * 60 * 1000 });
                }
            } else {
                config = await this.modules.config.loadConfig();
            }
            
            console.log('Configuration loaded successfully');
            
            // Validate critical configuration
            const validation = this.modules.config.validateRequired([
                'chainId', 'rpcUrl', 'contractAddress'
            ]);
            
            // Additional type validation if available
            if (this.typeValidator && config) {
                const configValidation = this.typeValidator.validate(config, 'Config');
                if (!configValidation.isValid) {
                    console.warn('Configuration type validation failed:', configValidation.errors);
                }
            }
            
            if (!validation.isValid) {
                console.warn('Configuration validation failed:', validation);
                this.modules.ui.showNotification(
                    'Configuration Warning',
                    `Missing configuration items: ${validation.missing.join(', ')}`,
                    'warning'
                );
            }
            
        } catch (error) {
            console.error('Configuration initialization failed:', error);
            if (this.errorHandler) {
                this.errorHandler.handleError(error, {
                    context: 'Configuration loading',
                    severity: 'high'
                });
            }
            throw error;
        }
    }

    /**
     * Set up global error handling
     */
    setupGlobalErrorHandling() {
        // Uncaught errors
        window.addEventListener('error', (event) => {
            if (this.errorHandler) {
                this.errorHandler.handleError(event.error, {
                    context: 'Global error',
                    severity: 'high',
                    userMessage: 'An unexpected error occurred. Please refresh the page.'
                });
            } else {
                this.handleGlobalError(event.error, 'JavaScript Error');
            }
        });

        // Unhandled Promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            if (this.errorHandler) {
                this.errorHandler.handleError(event.reason, {
                    context: 'Unhandled promise rejection',
                    severity: 'high',
                    userMessage: 'An unexpected error occurred. Please try again.'
                });
            } else {
                this.handleGlobalError(event.reason, 'Unhandled Promise Rejection');
            }
        });

        // Network errors
        window.addEventListener('offline', () => {
            this.modules.ui.showStatus('Network connection lost', 'warning');
        });

        window.addEventListener('online', () => {
            this.modules.ui.showStatus('Network connection restored', 'success');
        });
    }

    /**
     * Handle global errors
     */
    handleGlobalError(error, type) {
        // Filter out known harmless errors
        const ignoredErrors = [
            'ResizeObserver loop limit exceeded',
            'Non-Error promise rejection captured',
            'Extension context invalidated',
            'chrome-extension://',
            'moz-extension://',
            'safari-extension://'
        ];

        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        
        if (ignoredErrors.some(ignored => errorMessage.includes(ignored))) {
            return; // Ignore these errors
        }

        console.error(`[${type}]`, error);
        
        // Show detailed errors only in development environment
        if (this.modules.config?.isDevelopment()) {
            this.modules.ui.showNotification(
                type,
                errorMessage,
                'error'
            );
        }
    }

    /**
     * Initialize event system
     */
    initializeEventSystem() {
        // Wallet connection events
        this.on('wallet:connected', async (userAddress) => {
            console.log('Wallet connected:', userAddress);
            this.state.isConnected = true;
            
            try {
                await this.initializeContract();
                await this.loadUserInfo();
                await this.loadProposals();
            } catch (error) {
                console.error('Post-wallet connection initialization failed:', error);
            }
        });

        // Wallet disconnection events
        this.on('wallet:disconnected', () => {
            console.log('Wallet disconnected');
            this.state.isConnected = false;
            this.state.userInfo = null;
            this.clearUserData();
        });

        // Contract events
        this.on('contract:initialized', () => {
            console.log('Contract initialized');
        });

        // Proposal update events
        this.on('proposals:updated', (proposals) => {
            this.state.proposals = proposals;
            this.state.lastUpdate = new Date();
            this.modules.ui.updateProposalsList(proposals);
        });
    }

    /**
     * Try auto-connect wallet
     */
    async tryAutoConnect() {
        try {
            // Check if previously connected
            if (window.ethereum && window.ethereum.selectedAddress) {
                console.log('Detected connected wallet, attempting auto-connect...');
                const success = await this.modules.wallet.connect();
                
                if (success) {
                    this.emit('wallet:connected', window.ethereum.selectedAddress);
                }
            }
        } catch (error) {
            console.log('Auto-connect failed:', error);
            // Auto-connect failure is not fatal, continue initialization
        }
    }

    /**
     * Initialize contract
     */
    async initializeContract() {
        try {
            const config = this.modules.config.getContractConfig();
            
            if (!config.address) {
                throw new Error('Contract address not configured');
            }

            await this.modules.contract.initialize({
                contractAddress: config.address,
                abi: window.CONTRACT_ABI || config.abi
            });
            
            this.emit('contract:initialized');
            
        } catch (error) {
            console.error('Contract initialization failed:', error);
            throw error;
        }
    }

    /**
     * Load user information
     */
    async loadUserInfo() {
        try {
            if (!this.modules.contract.isReady()) {
                throw new Error('Contract not initialized');
            }

            const userInfo = await this.modules.contract.checkUserRole();
            this.state.userInfo = userInfo;
            
            this.modules.ui.updateUserInfo(userInfo);
            this.updateUIBasedOnRole(userInfo);
            
            console.log('✅ User information loaded successfully:', userInfo);
            
        } catch (error) {
            console.error('❌ Failed to load user information:', error);
            this.modules.ui.showStatus('Failed to load user information', 'error');
        }
    }

    /**
     * Update UI based on user role
     */
    updateUIBasedOnRole(userInfo) {
        const adminSection = document.getElementById('adminSection');
        const voterSection = document.getElementById('voterSection');
        
        if (adminSection) {
            adminSection.style.display = userInfo.isOwner ? 'block' : 'none';
        }
        
        if (voterSection) {
            voterSection.style.display = userInfo.isAuthorizedVoter ? 'block' : 'none';
        }
    }

    /**
     * Load proposal list
     */
    async loadProposals() {
        try {
            if (!this.modules.contract.isReady()) {
                console.log('Contract not initialized, skipping proposal loading');
                return;
            }

            // Try cache first
            let proposals;
            if (this.cacheManager) {
                const cacheKey = 'proposals_' + (this.state.userInfo?.address || 'anonymous');
                const cachedProposals = this.cacheManager.get(cacheKey);
                
                if (cachedProposals) {
                    proposals = cachedProposals;
                    this.emit('proposals:updated', proposals);
                    console.log(`Loaded ${proposals.length} proposals from cache`);
                    
                    // Load fresh data in background
                    this.loadProposalsInBackground(cacheKey);
                    return;
                }
            }

            // Show loading state
            if (this.stateManager) {
                this.stateManager.dispatch({
                    type: 'SET_LOADING',
                    payload: { loading: true, message: 'Loading proposals...' }
                });
            }

            // Load proposals with retry
            if (this.errorHandler) {
                proposals = await this.errorHandler.retry(
                    () => this.modules.contract.getProposals(),
                    { maxRetries: 2, context: 'load_proposals' }
                );
            } else {
                proposals = await this.modules.contract.getProposals();
            }

            // Validate proposals if type validator is available
            if (this.typeValidator) {
                const validProposals = [];
                for (const proposal of proposals) {
                    const validation = this.typeValidator.validate(proposal, 'Proposal');
                    if (validation.isValid) {
                        validProposals.push(validation.data);
                    } else {
                        console.warn('Invalid proposal data:', validation.errors);
                    }
                }
                proposals = validProposals;
            }

            // Cache proposals for 5 minutes
            if (this.cacheManager) {
                const cacheKey = 'proposals_' + (this.state.userInfo?.address || 'anonymous');
                this.cacheManager.set(cacheKey, proposals, { 
                    ttl: 5 * 60 * 1000,
                    tags: ['proposals', 'contract_data']
                });
            }

            this.emit('proposals:updated', proposals);
            
            // Update state
            if (this.stateManager) {
                this.stateManager.dispatch({
                    type: 'SET_PROPOSALS',
                    payload: { proposals }
                });
                
                this.stateManager.dispatch({
                    type: 'SET_LOADING',
                    payload: { loading: false }
                });
            }
            
            console.log('Proposal list loaded successfully:', proposals.length, 'proposals');
            
        } catch (error) {
            console.error('Failed to load proposal list:', error);
            this.modules.ui.showStatus('Failed to load proposals', 'warning');
            
            if (this.stateManager) {
                this.stateManager.dispatch({
                    type: 'SET_LOADING',
                    payload: { loading: false }
                });
            }
            
            if (this.errorHandler) {
                this.errorHandler.handleError(error, {
                    context: 'Loading proposals',
                    severity: 'medium',
                    userMessage: 'Failed to load proposals. Please try refreshing the page.'
                });
            }
        }
    }

    /**
     * Load initial data
     */
    async loadInitialData() {
        // Load test proposals by default so users can see blockchain proposals immediately
        try {
            await this.loadTestData();
            console.log('✅ Test blockchain proposals loaded on startup');
        } catch (error) {
            console.error('❌ Failed to load test proposals:', error);
        }
        
        // If wallet is connected, load related data
        if (this.state.isConnected) {
            await this.loadProposals();
        }
    }

    /**
     * Clear user data
     */
    clearUserData() {
        const userInfoDiv = document.getElementById('userInfo');
        if (userInfoDiv) {
            userInfoDiv.classList.add('hidden');
        }
        
        const adminSection = document.getElementById('adminSection');
        const voterSection = document.getElementById('voterSection');
        
        if (adminSection) adminSection.style.display = 'none';
        if (voterSection) voterSection.style.display = 'none';
    }

    /**
     * Show initialization status
     */
    showInitStatus(message, type = 'info') {
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `status ${type} show`;
        }
        console.log(`[INIT] ${message}`);
    }

    /**
     * Event listening
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    /**
     * Remove event listeners
     */
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Trigger event
     */
    emit(event, ...args) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`Event handler error [${event}]:`, error);
                }
            });
        }
    }

    /**
     * Get application state
     */
    getState() {
        return {
            ...this.state,
            isInitialized: this.isInitialized,
            modules: Object.keys(this.modules).reduce((acc, key) => {
                acc[key] = !!this.modules[key];
                return acc;
            }, {})
        };
    }

    /**
     * Refresh application data
     */
    async refresh() {
        try {
            this.modules.ui.showStatus('Refreshing data...', 'info');
            
            if (this.state.isConnected) {
                await this.loadUserInfo();
                await this.loadProposals();
            }
            
            this.modules.ui.showStatus('Data refresh completed', 'success');
            
        } catch (error) {
            console.error('Refresh failed:', error);
            this.modules.ui.showStatus('Refresh failed', 'error');
        }
    }

    /**
     * Restart application
     */
    async restart() {
        try {
            this.modules.ui.showStatus('Restarting application...', 'info');
            
            // Clean up state
            this.isInitialized = false;
            this.state = {
                isConnected: false,
                userInfo: null,
                proposals: [],
                lastUpdate: null
            };
            
            // Re-initialize
            await this.initialize();
            
        } catch (error) {
            console.error('Restart failed:', error);
            this.modules.ui.showStatus('Restart failed', 'error');
        }
    }

    /**
     * Get debug information
     */
    getDebugInfo() {
        return {
            app: this.getState(),
            config: this.modules.config?.getDebugInfo(),
            wallet: {
                isConnected: this.modules.wallet?.isConnected(),
                address: this.modules.wallet?.getAddress()
            },
            contract: {
                isReady: this.modules.contract?.isReady(),
                address: this.modules.contract?.contractAddress
            },
            ui: {
                notifications: this.modules.ui?.notifications?.length || 0,
                loadingElements: this.modules.ui?.loadingElements?.size || 0
            },
            optimization: {
                cache: this.cacheManager?.getStats(),
                performance: this.performanceOptimizer?.getMetrics(),
                errors: this.errorHandler?.getErrorStats()
            }
        };
    }
    
    /**
     * Handle state changes
     */
    handleStateChange(state, action) {
        // Handle state changes and update UI accordingly
        switch (action.type) {
            case 'SET_ERROR':
                if (this.modules.ui && state.error) {
                    this.modules.ui.showError(state.error.message);
                }
                break;
            case 'SET_LOADING':
                if (this.modules.ui && state.ui) {
                    this.modules.ui.setLoading(state.ui.loading, state.ui.loadingMessage);
                }
                break;
            case 'SET_USER_CONNECTED':
                if (this.modules.ui && state.user) {
                    this.modules.ui.updateUserInfo(state.user.info);
                }
                break;
            case 'SET_PROPOSALS':
                if (this.modules.ui && state.proposals) {
                    this.modules.ui.renderProposals(state.proposals.list);
                }
                break;
        }
    }
    
    /**
     * Load proposals in background
     */
    async loadProposalsInBackground(cacheKey) {
        try {
            const proposals = await this.modules.contract.getProposals();
            let validProposals = proposals;
            
            // Validate proposals if type validator is available
            if (this.typeValidator) {
                validProposals = [];
                for (const proposal of proposals) {
                    const validation = this.typeValidator.validate(proposal, 'Proposal');
                    if (validation.isValid) {
                        validProposals.push(validation.data);
                    }
                }
            }
            
            // Update cache
            if (this.cacheManager) {
                this.cacheManager.set(cacheKey, validProposals, { 
                    ttl: 5 * 60 * 1000,
                    tags: ['proposals', 'contract_data']
                });
            }
            
            // Update UI if data changed
            if (JSON.stringify(validProposals) !== JSON.stringify(this.state.proposals)) {
                this.state.proposals = validProposals;
                if (this.stateManager) {
                    this.stateManager.dispatch({
                        type: 'SET_PROPOSALS',
                        payload: { proposals: validProposals }
                    });
                }
                
                this.emit('proposals:updated', validProposals);
            }
        } catch (error) {
            console.warn('Background proposal loading failed:', error);
        }
    }
    
    /**
     * Utility methods with performance optimization
     */
    debounce(func, wait) {
        if (this.performanceOptimizer) {
            return this.performanceOptimizer.debounce(func, wait);
        }
        // Fallback implementation
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    throttle(func, limit) {
        if (this.performanceOptimizer) {
            return this.performanceOptimizer.throttle(func, limit);
        }
        // Fallback implementation
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // Performance monitoring methods
    measurePerformance(name, fn) {
        if (this.performanceOptimizer) {
            return this.performanceOptimizer.measurePerformance(name, fn);
        }
        return fn();
    }
    
    // Cache management methods
    clearCache(pattern) {
        if (this.cacheManager) {
            if (pattern) {
                this.cacheManager.clear({ pattern });
            } else {
                this.cacheManager.clear();
            }
        }
    }
    
    getCacheStats() {
        return this.cacheManager?.getStats() || {};
    }
    
    // Type validation helpers
    validateData(data, schema) {
        if (this.typeValidator) {
            return this.typeValidator.validate(data, schema);
        }
        return { isValid: true, data };
    }
    
    // Error handling helpers
    handleError(error, options = {}) {
        if (this.errorHandler) {
            return this.errorHandler.handleError(error, options);
        }
        console.error('Application error:', error);
    }
    
    withRetry(fn, options = {}) {
        if (this.errorHandler) {
            return this.errorHandler.retry(fn, options);
        }
        return fn();
    }

    /**
     * Load test data
     */
    async loadTestData() {
        try {
            console.log('🧪 Loading test data');
            
            const testProposals = [
                {
                    id: 1,
                    title: "Ethereum 2.0 Staking Pool Implementation",
                    description: "Proposal to implement a decentralized staking pool for Ethereum 2.0 validators. This would allow smaller holders to participate in staking with lower barriers to entry, while maintaining decentralization and security of the network.",
                    creator: "0x1234567890123456789012345678901234567890",
                    creationTime: Date.now() - 86400000, // 1 day ago
                    endTime: Date.now() + 604800000, // 7 days from now
                    isActive: true,
                    isFinalized: false,
                    yesVotes: 45,
                    noVotes: 12,
                    totalVotes: 57
                },
                {
                    id: 2,
                    title: "Cross-Chain Bridge Protocol Upgrade",
                    description: "A comprehensive proposal to upgrade our cross-chain bridge protocol with enhanced security features, support for additional blockchains, and improved transaction throughput to facilitate seamless asset transfers across multiple networks.",
                    creator: "0x2345678901234567890123456789012345678901",
                    creationTime: Date.now() - 172800000, // 2 days ago
                    endTime: Date.now() + 432000000, // 5 days from now
                    isActive: true,
                    isFinalized: false,
                    yesVotes: 78,
                    noVotes: 23,
                    totalVotes: 101
                },
                {
                    id: 3,
                    title: "DeFi Yield Farming Protocol Launch",
                    description: "Proposal to launch a new DeFi yield farming protocol with innovative liquidity mining mechanisms, automated market making, and governance token distribution to maximize returns for liquidity providers while ensuring protocol sustainability.",
                    creator: "0x3456789012345678901234567890123456789012",
                    creationTime: Date.now() - 259200000, // 3 days ago
                    endTime: Date.now() + 259200000, // 3 days from now
                    isActive: true,
                    isFinalized: false,
                    yesVotes: 156,
                    noVotes: 34,
                    totalVotes: 190
                },
                {
                    id: 4,
                    title: "Layer 2 Scaling Solution Integration",
                    description: "A proposal to integrate advanced Layer 2 scaling solutions including Optimistic Rollups and zk-SNARKs to reduce transaction costs by 90% and increase throughput to 10,000 TPS while maintaining full Ethereum compatibility.",
                    creator: "0x4567890123456789012345678901234567890123",
                    creationTime: Date.now() - 345600000, // 4 days ago
                    endTime: Date.now() + 172800000, // 2 days from now
                    isActive: true,
                    isFinalized: false,
                    yesVotes: 203,
                    noVotes: 67,
                    totalVotes: 270
                }
            ];

            // Render test proposals
            this.renderTestProposals(testProposals);
            
            // Update statistics
            this.updateTestStats(testProposals);
            
            console.log('✅ Test data loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load test data:', error);
            throw error;
        }
    }

    /**
     * Clear test data
     */
    async clearTestData() {
        try {
            console.log('🧹 Clearing test data');
            
            const proposalsList = document.getElementById('proposalsList');
            if (proposalsList) {
                proposalsList.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: #718096;">
                        <div style="font-size: 3rem; margin-bottom: 20px;">🗳️</div>
                        <h3 style="margin-bottom: 15px; color: #4a5568;">Welcome to SecureVote</h3>
                        <p style="margin-bottom: 20px; line-height: 1.6;">No proposals available yet. Get started by:</p>
                        <div style="display: flex; flex-direction: column; gap: 10px; max-width: 400px; margin: 0 auto;">
                            <div style="background: #f7fafc; padding: 15px; border-radius: 10px; border-left: 4px solid #667eea;">
                                <strong>🧪 Try the Demo:</strong> Click "Load Test Proposals" above to explore the voting system with sample data
                            </div>
                            <div style="background: #f7fafc; padding: 15px; border-radius: 10px; border-left: 4px solid #48bb78;">
                                <strong>🔗 Connect Wallet:</strong> Connect your wallet to create real proposals and participate in voting
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Reset statistics
            this.updateTestStats([]);
            
            console.log('✅ Test data cleared successfully');
            
        } catch (error) {
            console.error('❌ Failed to clear test data:', error);
            throw error;
        }
    }

    /**
     * Render test proposals
     */
    renderTestProposals(proposals) {
        const proposalsList = document.getElementById('proposalsList');
        if (!proposalsList) return;

        proposalsList.innerHTML = proposals.map(proposal => {
            const timeLeft = Math.max(0, proposal.endTime - Date.now());
            const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            
            const yesPercentage = proposal.totalVotes > 0 ? (proposal.yesVotes / proposal.totalVotes * 100).toFixed(1) : 0;
            const noPercentage = proposal.totalVotes > 0 ? (proposal.noVotes / proposal.totalVotes * 100).toFixed(1) : 0;

            return `
                <div class="proposal-card" data-proposal-id="${proposal.id}">
                    <div class="proposal-header">
                        <h3>${proposal.title}</h3>
                        <span class="proposal-status ${proposal.isActive ? 'active' : 'inactive'}">
                            ${proposal.isActive ? '🟢 Active' : '🔴 Ended'}
                        </span>
                    </div>
                    
                    <p class="proposal-description">${proposal.description}</p>
                    
                    <div class="proposal-meta">
                        <div class="meta-item">
                            <span class="meta-label">Creator:</span>
                            <span class="meta-value">${proposal.creator.slice(0, 6)}...${proposal.creator.slice(-4)}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Time Left:</span>
                            <span class="meta-value">${daysLeft}d ${hoursLeft}h</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Total Votes:</span>
                            <span class="meta-value">${proposal.totalVotes}</span>
                        </div>
                    </div>
                    
                    <div class="voting-results">
                        <div class="result-bar">
                            <div class="result-segment yes" style="width: ${yesPercentage}%"></div>
                            <div class="result-segment no" style="width: ${noPercentage}%"></div>
                        </div>
                        <div class="result-stats">
                            <span class="yes-votes">✅ Yes: ${proposal.yesVotes} (${yesPercentage}%)</span>
                            <span class="no-votes">❌ No: ${proposal.noVotes} (${noPercentage}%)</span>
                        </div>
                    </div>
                    
                    <div class="proposal-actions">
                        <button class="btn btn-success" onclick="handleTestVote(${proposal.id}, true)" ${!proposal.isActive ? 'disabled' : ''}>
                            ✅ Vote Yes
                        </button>
                        <button class="btn btn-danger" onclick="handleTestVote(${proposal.id}, false)" ${!proposal.isActive ? 'disabled' : ''}>
                            ❌ Vote No
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Update test statistics
     */
    updateTestStats(proposals) {
        const totalProposalsEl = document.getElementById('totalProposals');
        const activeProposalsEl = document.getElementById('activeProposals');
        const myVotesEl = document.getElementById('myVotes');

        if (totalProposalsEl) totalProposalsEl.textContent = proposals.length;
        if (activeProposalsEl) activeProposalsEl.textContent = proposals.filter(p => p.isActive).length;
        if (myVotesEl) myVotesEl.textContent = '0'; // Test data doesn't track individual votes
    }
}

// Export AppController class for global use
window.AppController = AppController;

// Backward compatible global functions (will be set after initialization)
window.init = () => {
    if (window.appController) {
        return window.appController.initialize();
    }
};
window.loadUserInfo = () => {
    if (window.appController) {
        return window.appController.loadUserInfo();
    }
};
window.loadProposals = () => {
    if (window.appController) {
        return window.appController.loadProposals();
    }
};

// Note: Initialization is now handled in index.html to avoid conflicts