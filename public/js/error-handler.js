/**
 * Enhanced Error Handling and Retry Mechanism
 * Provides unified error handling, retry logic, and user-friendly error messages
 */

class ErrorHandler {
    constructor() {
        this.errorTypes = {
            NETWORK_ERROR: 'network',
            CONTRACT_ERROR: 'contract',
            WALLET_ERROR: 'wallet',
            VALIDATION_ERROR: 'validation',
            PERMISSION_ERROR: 'permission',
            TIMEOUT_ERROR: 'timeout',
            UNKNOWN_ERROR: 'unknown'
        };
        
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
        };
        
        this.errorMessages = {
            network: {
                title: 'Network Error',
                message: 'Please check your internet connection and try again.',
                icon: '🌐'
            },
            contract: {
                title: 'Smart Contract Error',
                message: 'There was an issue with the blockchain transaction.',
                icon: '⛓️'
            },
            wallet: {
                title: 'Wallet Error',
                message: 'Please check your wallet connection and try again.',
                icon: '👛'
            },
            validation: {
                title: 'Validation Error',
                message: 'Please check your input and try again.',
                icon: '⚠️'
            },
            permission: {
                title: 'Permission Denied',
                message: 'You do not have permission to perform this action.',
                icon: '🚫'
            },
            timeout: {
                title: 'Request Timeout',
                message: 'The request took too long to complete. Please try again.',
                icon: '⏱️'
            },
            unknown: {
                title: 'Unexpected Error',
                message: 'An unexpected error occurred. Please try again.',
                icon: '❌'
            }
        };
    }
    
    /**
     * Handle error with automatic classification and user notification
     */
    async handleError(error, context = '', options = {}) {
        const errorInfo = this.classifyError(error);
        const errorId = this.generateErrorId();
        
        // Log error for debugging
        this.logError(error, context, errorId, errorInfo);
        
        // Store error in state
        if (window.stateManager) {
            window.stateManager.dispatch({
                type: 'ERROR_OCCURRED',
                payload: {
                    id: errorId,
                    type: errorInfo.type,
                    message: error.message || error.toString(),
                    context,
                    timestamp: Date.now(),
                    stack: error.stack
                }
            });
        }
        
        // Show user notification if not suppressed
        if (!options.silent && window.uiManager) {
            const userMessage = this.getUserFriendlyMessage(errorInfo, error);
            window.uiManager.showNotification(
                userMessage.title,
                userMessage.message,
                'error',
                {
                    duration: options.duration || 5000,
                    actions: options.actions || []
                }
            );
        }
        
        return {
            id: errorId,
            type: errorInfo.type,
            canRetry: errorInfo.canRetry,
            userMessage: this.getUserFriendlyMessage(errorInfo, error)
        };
    }
    
    /**
     * Retry function with exponential backoff
     */
    async retry(fn, options = {}) {
        const config = { ...this.retryConfig, ...options };
        let lastError;
        
        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
                const result = await fn(attempt);
                
                // Log successful retry
                if (attempt > 0) {
                    console.log(`✅ Operation succeeded after ${attempt} retries`);
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                
                // Don't retry on certain error types
                const errorInfo = this.classifyError(error);
                if (!errorInfo.canRetry || attempt === config.maxRetries) {
                    break;
                }
                
                // Calculate delay with exponential backoff
                const delay = Math.min(
                    config.baseDelay * Math.pow(config.backoffFactor, attempt),
                    config.maxDelay
                );
                
                console.log(`⏳ Retry attempt ${attempt + 1}/${config.maxRetries} in ${delay}ms`);
                
                // Wait before retry
                await this.sleep(delay);
            }
        }
        
        // All retries failed
        throw lastError;
    }
    
    /**
     * Classify error type and determine retry strategy
     */
    classifyError(error) {
        const message = error.message?.toLowerCase() || '';
        const code = error.code;
        
        // Network errors
        if (message.includes('network') || message.includes('fetch') || 
            message.includes('connection') || code === 'NETWORK_ERROR') {
            return {
                type: this.errorTypes.NETWORK_ERROR,
                canRetry: true,
                severity: 'medium'
            };
        }
        
        // Contract errors
        if (message.includes('revert') || message.includes('gas') || 
            message.includes('contract') || code === 'CALL_EXCEPTION') {
            return {
                type: this.errorTypes.CONTRACT_ERROR,
                canRetry: false,
                severity: 'high'
            };
        }
        
        // Wallet errors
        if (message.includes('wallet') || message.includes('metamask') || 
            message.includes('user rejected') || code === 4001) {
            return {
                type: this.errorTypes.WALLET_ERROR,
                canRetry: true,
                severity: 'medium'
            };
        }
        
        // Validation errors
        if (message.includes('invalid') || message.includes('validation') || 
            message.includes('required')) {
            return {
                type: this.errorTypes.VALIDATION_ERROR,
                canRetry: false,
                severity: 'low'
            };
        }
        
        // Permission errors
        if (message.includes('permission') || message.includes('unauthorized') || 
            message.includes('forbidden') || code === 403) {
            return {
                type: this.errorTypes.PERMISSION_ERROR,
                canRetry: false,
                severity: 'high'
            };
        }
        
        // Timeout errors
        if (message.includes('timeout') || message.includes('timed out') || 
            code === 'TIMEOUT') {
            return {
                type: this.errorTypes.TIMEOUT_ERROR,
                canRetry: true,
                severity: 'medium'
            };
        }
        
        // Default to unknown error
        return {
            type: this.errorTypes.UNKNOWN_ERROR,
            canRetry: true,
            severity: 'medium'
        };
    }
    
    /**
     * Get user-friendly error message
     */
    getUserFriendlyMessage(errorInfo, originalError) {
        const baseMessage = this.errorMessages[errorInfo.type.replace('_error', '')];
        
        // Customize message based on specific error
        let customMessage = baseMessage.message;
        
        if (errorInfo.type === this.errorTypes.CONTRACT_ERROR) {
            if (originalError.message?.includes('insufficient funds')) {
                customMessage = 'Insufficient funds to complete the transaction.';
            } else if (originalError.message?.includes('gas')) {
                customMessage = 'Transaction failed due to gas issues. Please try again with higher gas limit.';
            } else if (originalError.message?.includes('revert')) {
                customMessage = 'Transaction was reverted by the smart contract.';
            }
        } else if (errorInfo.type === this.errorTypes.WALLET_ERROR) {
            if (originalError.code === 4001) {
                customMessage = 'Transaction was rejected by user.';
            } else if (originalError.message?.includes('not connected')) {
                customMessage = 'Please connect your wallet first.';
            }
        }
        
        return {
            title: baseMessage.title,
            message: customMessage,
            icon: baseMessage.icon
        };
    }
    
    /**
     * Create safe async wrapper
     */
    createSafeWrapper(fn, context = '', options = {}) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                const errorResult = await this.handleError(error, context, options);
                
                if (options.throwOnError !== false) {
                    throw error;
                }
                
                return {
                    success: false,
                    error: errorResult
                };
            }
        };
    }
    
    /**
     * Create retry wrapper
     */
    createRetryWrapper(fn, context = '', retryOptions = {}) {
        return async (...args) => {
            return this.retry(
                async (attempt) => {
                    try {
                        return await fn(...args);
                    } catch (error) {
                        if (attempt > 0) {
                            console.log(`🔄 Retrying ${context} (attempt ${attempt})`);
                        }
                        throw error;
                    }
                },
                retryOptions
            );
        };
    }
    
    /**
     * Utility methods
     */
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    logError(error, context, errorId, errorInfo) {
        const logData = {
            id: errorId,
            context,
            type: errorInfo.type,
            severity: errorInfo.severity,
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        console.group(`🚨 Error [${errorId}]`);
        console.error('Context:', context);
        console.error('Type:', errorInfo.type);
        console.error('Severity:', errorInfo.severity);
        console.error('Original Error:', error);
        console.error('Full Log Data:', logData);
        console.groupEnd();
        
        // Send to monitoring service in production
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            this.sendToMonitoring(logData);
        }
    }
    
    async sendToMonitoring(logData) {
        try {
            // Implement your monitoring service integration here
            // Example: Sentry, LogRocket, etc.
            console.log('📊 Sending error to monitoring service:', logData.id);
        } catch (error) {
            console.warn('Failed to send error to monitoring service:', error);
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Check if error should be ignored (browser extensions, etc.)
     */
    shouldIgnoreError(error, filename = '') {
        if (!error) return true;
        
        const errorMessage = error.message || error.toString();
        const errorStack = error.stack || '';
        
        // Browser extension errors
        const extensionPatterns = [
            'solana.js',
            'btc.js', 
            'sui.js',
            'inject.js',
            'content-script',
            'extension://',
            'chrome-extension://',
            'moz-extension://',
            'Cannot destructure property \'register\' of \'undefined\'',
            'phantom',
            'metamask',
            'coinbase',
            'walletconnect'
        ];
        
        // Check if error is from browser extension
        const isExtensionError = extensionPatterns.some(pattern => 
            errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
            errorStack.toLowerCase().includes(pattern.toLowerCase()) ||
            filename.toLowerCase().includes(pattern.toLowerCase())
        );
        
        if (isExtensionError) {
            console.debug('🔇 Ignoring browser extension error:', errorMessage);
            return true;
        }
        
        // Ignore common non-critical errors
        const ignoredMessages = [
            'Script error',
            'Non-Error promise rejection captured',
            'ResizeObserver loop limit exceeded',
            'Network request failed'
        ];
        
        const shouldIgnore = ignoredMessages.some(msg => 
            errorMessage.includes(msg)
        );
        
        if (shouldIgnore) {
            console.debug('🔇 Ignoring non-critical error:', errorMessage);
            return true;
        }
        
        return false;
    }
    
    /**
     * Get error statistics
     */
    getErrorStats() {
        if (!window.stateManager) return null;
        
        const errors = window.stateManager.getState().errors;
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        const recentErrors = errors.filter(err => now - err.timestamp < oneHour);
        const errorsByType = recentErrors.reduce((acc, err) => {
            acc[err.type] = (acc[err.type] || 0) + 1;
            return acc;
        }, {});
        
        return {
            total: errors.length,
            recent: recentErrors.length,
            byType: errorsByType,
            lastError: errors[errors.length - 1] || null
        };
    }
}

// Create global error handler instance
window.errorHandler = new ErrorHandler();

// Set up global error listeners with filtering
window.addEventListener('error', (event) => {
    // Filter out browser extension errors
    if (window.errorHandler.shouldIgnoreError(event.error, event.filename)) {
        return;
    }
    window.errorHandler.handleError(event.error, 'Global Error Handler');
});

window.addEventListener('unhandledrejection', (event) => {
    // Filter out browser extension errors
    if (window.errorHandler.shouldIgnoreError(event.reason)) {
        return;
    }
    window.errorHandler.handleError(event.reason, 'Unhandled Promise Rejection');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}