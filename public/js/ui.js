/**
 * UI Management Module
 * Handles interface updates, status display and user interaction
 */

class UIManager {
    constructor() {
        this.statusTimeout = null;
        this.loadingElements = new Set();
        this.notifications = [];
    }

    /**
     * Initialize UI manager
     */
    initialize() {
        this.setupEventListeners();
        this.initializeComponents();
        console.log('UI manager initialization completed');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Connect wallet button
        const connectBtn = document.getElementById('connectWallet');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.handleWalletConnect());
        }

        // Add voter form
        const addVoterForm = document.getElementById('addVoterForm');
        if (addVoterForm) {
            addVoterForm.addEventListener('submit', (e) => this.handleAddVoter(e));
        }

        // Create proposal form
        const createProposalForm = document.getElementById('createProposalForm');
        if (createProposalForm) {
            createProposalForm.addEventListener('submit', (e) => this.handleCreateProposal(e));
        }

        // Test data buttons
        const loadTestBtn = document.getElementById('loadTestData');
        const clearTestBtn = document.getElementById('clearTestData');
        
        if (loadTestBtn) {
            loadTestBtn.addEventListener('click', () => this.handleLoadTestData());
        }
        
        if (clearTestBtn) {
            clearTestBtn.addEventListener('click', () => this.handleClearTestData());
        }

        // Refresh button
        const refreshBtn = document.getElementById('refreshProposals');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.handleRefreshProposals());
        }
    }

    /**
     * Initialize components
     */
    initializeComponents() {
        // Initialize tooltips
        this.initializeTooltips();
        
        // Initialize modals
        this.initializeModals();
        
        // Set up responsive layout
        this.setupResponsiveLayout();
    }

    /**
     * Initialize tooltips
     */
    initializeTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => this.showTooltip(e));
            element.addEventListener('mouseleave', () => this.hideTooltip());
        });
    }

    /**
     * Show tooltip
     */
    showTooltip(event) {
        const text = event.target.getAttribute('data-tooltip');
        if (!text) return;

        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = text;
        tooltip.id = 'active-tooltip';
        
        document.body.appendChild(tooltip);
        
        const rect = event.target.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        const tooltip = document.getElementById('active-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    /**
     * Initialize modals
     */
    initializeModals() {
        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });

        // Close modal with ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal.show');
                if (openModal) {
                    this.closeModal(openModal);
                }
            }
        });
    }

    /**
     * Set up responsive layout
     */
    setupResponsiveLayout() {
        // Listen for window resize
        window.addEventListener('resize', () => {
            this.adjustLayout();
        });
        
        // Initial adjustment
        this.adjustLayout();
    }

    /**
     * Adjust layout
     */
    adjustLayout() {
        const container = document.querySelector('.container');
        if (!container) return;

        if (window.innerWidth < 768) {
            container.classList.add('mobile-layout');
        } else {
            container.classList.remove('mobile-layout');
        }
    }

    /**
     * Show status message
     * @param {string} message Message content
     * @param {string} type Message type (success, error, warning, info)
     * @param {number} duration Display duration (milliseconds)
     */
    showStatus(message, type = 'info', duration = 5000) {
        // Clear previous status
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }

        const statusDiv = document.getElementById('status');
        if (!statusDiv) return;

        // Set message and style
        statusDiv.textContent = message;
        statusDiv.className = `status ${type} show`;

        // Auto hide
        this.statusTimeout = setTimeout(() => {
            statusDiv.classList.remove('show');
        }, duration);

        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    /**
     * Show notification
     * @param {string} title Notification title
     * @param {string} message Notification content
     * @param {string} type Notification type
     */
    showNotification(title, message, type = 'info') {
        const notification = {
            id: Date.now(),
            title,
            message,
            type,
            timestamp: new Date()
        };

        this.notifications.push(notification);
        this.renderNotification(notification);

        // Auto remove
        setTimeout(() => {
            this.removeNotification(notification.id);
        }, 8000);
    }

    /**
     * Render notification
     */
    renderNotification(notification) {
        const container = this.getNotificationContainer();
        
        const notificationEl = document.createElement('div');
        notificationEl.className = `notification ${notification.type}`;
        notificationEl.setAttribute('data-id', notification.id);
        
        notificationEl.innerHTML = `
            <div class="notification-header">
                <h4>${notification.title}</h4>
                <button class="close-btn" onclick="uiManager.removeNotification(${notification.id})">&times;</button>
            </div>
            <div class="notification-body">
                <p>${notification.message}</p>
                <small>${notification.timestamp.toLocaleTimeString()}</small>
            </div>
        `;
        
        container.appendChild(notificationEl);
        
        // Add animation
        setTimeout(() => {
            notificationEl.classList.add('show');
        }, 100);
    }

    /**
     * Get notification container
     */
    getNotificationContainer() {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        return container;
    }

    /**
     * Remove notification
     */
    removeNotification(id) {
        const notification = document.querySelector(`[data-id="${id}"]`);
        if (notification) {
            notification.classList.add('removing');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
        
        this.notifications = this.notifications.filter(n => n.id !== id);
    }

    /**
     * Show loading state
     * @param {string|HTMLElement} element Element ID or element object
     * @param {string} text Loading text
     */
    showLoading(element, text = 'Loading...') {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (!el) return;

        el.classList.add('loading');
        el.setAttribute('data-original-text', el.textContent);
        el.textContent = text;
        el.disabled = true;
        
        this.loadingElements.add(el);
    }

    /**
     * Hide loading state
     * @param {string|HTMLElement} element Element ID or element object
     */
    hideLoading(element) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (!el) return;

        el.classList.remove('loading');
        const originalText = el.getAttribute('data-original-text');
        if (originalText) {
            el.textContent = originalText;
            el.removeAttribute('data-original-text');
        }
        el.disabled = false;
        
        this.loadingElements.delete(el);
    }

    /**
     * Update user information display
     * @param {Object} userInfo User information
     */
    updateUserInfo(userInfo) {
        const userInfoDiv = document.getElementById('userInfo');
        if (!userInfoDiv) return;

        userInfoDiv.innerHTML = `
            <div class="user-card">
                <div class="user-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="user-details">
                    <div class="user-address">${this.formatAddress(userInfo.address)}</div>
                    <div class="user-roles">
                        ${userInfo.isOwner ? '<span class="role owner">Admin</span>' : ''}
                        ${userInfo.isAuthorizedVoter ? '<span class="role voter">Authorized Voter</span>' : ''}
                    </div>
                </div>
            </div>
        `;
        
        userInfoDiv.classList.remove('hidden');
    }

    /**
     * Format address display
     */
    formatAddress(address) {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Update proposal list
     * @param {Array} proposals Proposal list
     */
    updateProposalsList(proposals) {
        const container = document.getElementById('proposalsList');
        if (!container) return;

        if (proposals.length === 0) {
            container.innerHTML = '<div class="empty-state">No proposals available</div>';
            return;
        }

        container.innerHTML = proposals.map(proposal => 
            this.createProposalCard(proposal)
        ).join('');
    }

    /**
     * Create proposal card
     * @param {Object} proposal Proposal object
     */
    createProposalCard(proposal) {
        const isActive = proposal.isActive && Date.now() / 1000 < proposal.endTime;
        const endDate = new Date(proposal.endTime * 1000);
        
        return `
            <div class="proposal-card ${isActive ? 'active' : 'inactive'}">
                <div class="proposal-header">
                    <h3>Proposal #${proposal.id}</h3>
                    <span class="status ${isActive ? 'active' : 'ended'}">
                        ${isActive ? 'Active' : 'Ended'}
                    </span>
                </div>
                <div class="proposal-body">
                    <p class="description">${proposal.description}</p>
                    <div class="proposal-meta">
                        <div class="creator">Creator: ${this.formatAddress(proposal.creator)}</div>
                        <div class="end-time">End Time: ${endDate.toLocaleString()}</div>
                    </div>
                </div>
                ${isActive ? `
                    <div class="proposal-actions">
                        <button class="vote-btn support" onclick="uiManager.handleVote(${proposal.id}, true)">
                            <i class="fas fa-thumbs-up"></i> Support
                        </button>
                        <button class="vote-btn oppose" onclick="uiManager.handleVote(${proposal.id}, false)">
                            <i class="fas fa-thumbs-down"></i> Oppose
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Handle wallet connection
     */
    async handleWalletConnect() {
        try {
            this.showLoading('connectWallet', 'Connecting...');
            const success = await window.walletManager.connect();
            
            if (success) {
                this.showStatus('Wallet connected successfully', 'success');
                // Trigger user info loading
                window.loadUserInfo?.();
            }
        } catch (error) {
            this.showStatus('Failed to connect wallet', 'error');
        } finally {
            this.hideLoading('connectWallet');
        }
    }

    /**
     * Handle add voter
     */
    async handleAddVoter(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const voterAddress = formData.get('voterAddress');
        
        if (!voterAddress) {
            this.showStatus('Please enter voter address', 'warning');
            return;
        }

        try {
            this.showLoading('addVoterBtn', 'Adding...');
            await window.contractManager.addVoter(voterAddress);
            
            this.showStatus('Voter added successfully', 'success');
            event.target.reset();
        } catch (error) {
            this.showStatus('Failed to add voter', 'error');
        } finally {
            this.hideLoading('addVoterBtn');
        }
    }

    /**
     * Handle create proposal
     */
    async handleCreateProposal(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const description = formData.get('description');
        const duration = parseInt(formData.get('duration')) * 3600; // Convert to seconds
        
        if (!description || !duration) {
            this.showStatus('Please fill in complete proposal information', 'warning');
            return;
        }

        try {
            this.showLoading('createProposalBtn', 'Creating...');
            await window.contractManager.createProposal(description, duration);
            
            this.showStatus('Proposal created successfully', 'success');
            event.target.reset();
            
            // Refresh proposal list
            setTimeout(() => {
                this.handleRefreshProposals();
            }, 2000);
        } catch (error) {
            this.showStatus('Failed to create proposal', 'error');
        } finally {
            this.hideLoading('createProposalBtn');
        }
    }

    /**
     * Handle voting
     */
    async handleVote(proposalId, support) {
        try {
            this.showStatus(`${support ? 'Supporting' : 'Opposing'} proposal #${proposalId}...`, 'info');
            await window.contractManager.vote(proposalId, support);
            
            this.showStatus('Vote submitted successfully', 'success');
            this.showNotification(
                'Vote Confirmation',
                `You have ${support ? 'supported' : 'opposed'} proposal #${proposalId}`,
                'success'
            );
        } catch (error) {
            this.showStatus('Failed to vote', 'error');
        }
    }

    /**
     * Handle load test data
     */
    async handleLoadTestData() {
        try {
            this.showLoading('loadTestData', 'Loading...');
            await window.loadTestData?.();
            this.showStatus('Test data loaded successfully', 'success');
        } catch (error) {
            this.showStatus('Failed to load test data', 'error');
        } finally {
            this.hideLoading('loadTestData');
        }
    }

    /**
     * Handle clear test data
     */
    async handleClearTestData() {
        try {
            this.showLoading('clearTestData', 'Clearing...');
            await window.clearTestData?.();
            this.showStatus('Test data cleared successfully', 'success');
        } catch (error) {
            this.showStatus('Failed to clear test data', 'error');
        } finally {
            this.hideLoading('clearTestData');
        }
    }

    /**
     * Handle refresh proposals
     */
    async handleRefreshProposals() {
        try {
            this.showLoading('refreshProposals', 'Refreshing...');
            await window.loadProposals?.();
            this.showStatus('Proposal list refreshed', 'success');
        } catch (error) {
            this.showStatus('Failed to refresh', 'error');
        } finally {
            this.hideLoading('refreshProposals');
        }
    }

    /**
     * Show modal
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Close modal
     */
    closeModal(modal) {
        if (typeof modal === 'string') {
            modal = document.getElementById(modal);
        }
        
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    /**
     * Clean up all loading states
     */
    clearAllLoading() {
        this.loadingElements.forEach(el => {
            this.hideLoading(el);
        });
    }
}

// Export singleton instance
window.uiManager = new UIManager();

// Global status display function (backward compatibility)
window.showStatus = (message, type, duration) => {
    window.uiManager.showStatus(message, type, duration);
};