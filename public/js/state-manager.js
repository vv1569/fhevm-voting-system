/**
 * Centralized State Management System
 * Implements Redux-like pattern for better state control
 */

class StateManager {
    constructor() {
        this.state = {
            // Application state
            isInitialized: false,
            isConnected: false,
            
            // User state
            userInfo: null,
            userAddress: null,
            
            // Proposals state
            proposals: [],
            selectedProposal: null,
            
            // UI state
            loading: {
                app: false,
                wallet: false,
                proposals: false,
                voting: false
            },
            
            // Error state
            errors: [],
            
            // Network state
            networkInfo: null,
            
            // Cache
            cache: new Map(),
            
            // Timestamps
            lastUpdate: null,
            lastProposalUpdate: null
        };
        
        this.listeners = new Map();
        this.middleware = [];
        this.history = [];
        this.maxHistorySize = 50;
        
        // Bind methods
        this.dispatch = this.dispatch.bind(this);
        this.subscribe = this.subscribe.bind(this);
        this.getState = this.getState.bind(this);
    }
    
    /**
     * Get current state (immutable)
     */
    getState() {
        return JSON.parse(JSON.stringify(this.state));
    }
    
    /**
     * Dispatch action to update state
     */
    async dispatch(action) {
        try {
            // Validate action
            if (!action || typeof action.type !== 'string') {
                throw new Error('Invalid action: must have a type property');
            }
            
            const prevState = this.getState();
            
            // Apply middleware
            for (const middleware of this.middleware) {
                action = await middleware(action, prevState, this.dispatch);
                if (!action) return; // Middleware can cancel action
            }
            
            // Apply reducer
            const newState = this.reducer(prevState, action);
            
            // Update state if changed
            if (JSON.stringify(newState) !== JSON.stringify(prevState)) {
                this.state = newState;
                
                // Add to history
                this.addToHistory({
                    action,
                    prevState,
                    newState,
                    timestamp: Date.now()
                });
                
                // Notify listeners
                this.notifyListeners(action, prevState, newState);
            }
            
        } catch (error) {
            console.error('State dispatch error:', error);
            this.dispatch({
                type: 'ERROR_OCCURRED',
                payload: {
                    error: error.message,
                    action: action.type,
                    timestamp: Date.now()
                }
            });
        }
    }
    
    /**
     * State reducer
     */
    reducer(state, action) {
        switch (action.type) {
            case 'INIT_START':
                return {
                    ...state,
                    loading: { ...state.loading, app: true }
                };
                
            case 'INIT_SUCCESS':
                return {
                    ...state,
                    isInitialized: true,
                    loading: { ...state.loading, app: false }
                };
                
            case 'INIT_FAILURE':
                return {
                    ...state,
                    loading: { ...state.loading, app: false }
                };
                
            case 'WALLET_CONNECT_START':
                return {
                    ...state,
                    loading: { ...state.loading, wallet: true }
                };
                
            case 'WALLET_CONNECT_SUCCESS':
                return {
                    ...state,
                    isConnected: true,
                    userAddress: action.payload.address,
                    loading: { ...state.loading, wallet: false }
                };
                
            case 'WALLET_DISCONNECT':
                return {
                    ...state,
                    isConnected: false,
                    userAddress: null,
                    userInfo: null,
                    loading: { ...state.loading, wallet: false }
                };
                
            case 'USER_INFO_UPDATE':
                return {
                    ...state,
                    userInfo: action.payload
                };
                
            case 'PROPOSALS_LOAD_START':
                return {
                    ...state,
                    loading: { ...state.loading, proposals: true }
                };
                
            case 'PROPOSALS_LOAD_SUCCESS':
                return {
                    ...state,
                    proposals: action.payload,
                    lastProposalUpdate: Date.now(),
                    loading: { ...state.loading, proposals: false }
                };
                
            case 'PROPOSALS_LOAD_FAILURE':
                return {
                    ...state,
                    loading: { ...state.loading, proposals: false }
                };
                
            case 'PROPOSAL_SELECT':
                return {
                    ...state,
                    selectedProposal: action.payload
                };
                
            case 'VOTING_START':
                return {
                    ...state,
                    loading: { ...state.loading, voting: true }
                };
                
            case 'VOTING_SUCCESS':
            case 'VOTING_FAILURE':
                return {
                    ...state,
                    loading: { ...state.loading, voting: false }
                };
                
            case 'NETWORK_UPDATE':
                return {
                    ...state,
                    networkInfo: action.payload
                };
                
            case 'CACHE_SET':
                const newCache = new Map(state.cache);
                newCache.set(action.payload.key, {
                    data: action.payload.data,
                    timestamp: Date.now(),
                    ttl: action.payload.ttl || 300000 // 5 minutes default
                });
                return {
                    ...state,
                    cache: newCache
                };
                
            case 'CACHE_CLEAR':
                return {
                    ...state,
                    cache: new Map()
                };
                
            case 'ERROR_OCCURRED':
                return {
                    ...state,
                    errors: [...state.errors.slice(-9), action.payload] // Keep last 10 errors
                };
                
            case 'ERROR_CLEAR':
                return {
                    ...state,
                    errors: []
                };
                
            case 'STATE_RESET':
                return {
                    ...this.getInitialState(),
                    cache: state.cache // Preserve cache
                };
                
            default:
                return state;
        }
    }
    
    /**
     * Subscribe to state changes
     */
    subscribe(listener, selector = null) {
        const id = Date.now() + Math.random();
        this.listeners.set(id, { listener, selector });
        
        // Return unsubscribe function
        return () => {
            this.listeners.delete(id);
        };
    }
    
    /**
     * Add middleware
     */
    use(middleware) {
        this.middleware.push(middleware);
    }
    
    /**
     * Get cached data
     */
    getCache(key) {
        const cached = this.state.cache.get(key);
        if (!cached) return null;
        
        // Check if expired
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.dispatch({ type: 'CACHE_CLEAR' });
            return null;
        }
        
        return cached.data;
    }
    
    /**
     * Set cached data
     */
    setCache(key, data, ttl = 300000) {
        this.dispatch({
            type: 'CACHE_SET',
            payload: { key, data, ttl }
        });
    }
    
    /**
     * Get state history
     */
    getHistory() {
        return [...this.history];
    }
    
    /**
     * Get initial state
     */
    getInitialState() {
        return {
            isInitialized: false,
            isConnected: false,
            userInfo: null,
            userAddress: null,
            proposals: [],
            selectedProposal: null,
            loading: {
                app: false,
                wallet: false,
                proposals: false,
                voting: false
            },
            errors: [],
            networkInfo: null,
            cache: new Map(),
            lastUpdate: null,
            lastProposalUpdate: null
        };
    }
    
    /**
     * Private methods
     */
    notifyListeners(action, prevState, newState) {
        this.listeners.forEach(({ listener, selector }) => {
            try {
                if (selector) {
                    const prevSelected = selector(prevState);
                    const newSelected = selector(newState);
                    if (JSON.stringify(prevSelected) !== JSON.stringify(newSelected)) {
                        listener(newSelected, prevSelected, action);
                    }
                } else {
                    listener(newState, prevState, action);
                }
            } catch (error) {
                console.error('Listener error:', error);
            }
        });
    }
    
    addToHistory(entry) {
        this.history.push(entry);
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }
}

// Create global state manager instance
window.stateManager = new StateManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateManager;
}