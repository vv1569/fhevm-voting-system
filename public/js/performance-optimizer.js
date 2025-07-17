/**
 * Performance Optimization and Monitoring System
 * Provides request deduplication, caching, performance metrics, and optimization utilities
 */

class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.pendingRequests = new Map();
        this.metrics = {
            requests: [],
            cacheHits: 0,
            cacheMisses: 0,
            totalRequests: 0,
            averageResponseTime: 0,
            errors: 0
        };
        
        this.config = {
            defaultCacheTTL: 5 * 60 * 1000, // 5 minutes
            maxCacheSize: 100,
            maxMetricsHistory: 1000,
            performanceThreshold: 2000, // 2 seconds
            enableMetrics: true,
            enableCache: true,
            enableDeduplication: true
        };
        
        this.observers = {
            performance: null,
            intersection: null,
            mutation: null
        };
        
        this.init();
    }
    
    /**
     * Initialize performance monitoring
     */
    init() {
        if (this.config.enableMetrics) {
            this.setupPerformanceObserver();
            this.setupIntersectionObserver();
            this.startMetricsCollection();
        }
        
        // Clean up cache periodically
        setInterval(() => this.cleanupCache(), 60000); // Every minute
        
        // Log performance summary periodically
        setInterval(() => this.logPerformanceSummary(), 300000); // Every 5 minutes
    }
    
    /**
     * Optimized fetch with caching and deduplication
     */
    async optimizedFetch(url, options = {}) {
        const startTime = performance.now();
        const cacheKey = this.generateCacheKey(url, options);
        const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            // Check cache first
            if (this.config.enableCache && options.method !== 'POST') {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.recordMetric('cache_hit', performance.now() - startTime);
                    return cached;
                }
            }
            
            // Check for pending identical requests (deduplication)
            if (this.config.enableDeduplication) {
                if (this.pendingRequests.has(cacheKey)) {
                    console.log('🔄 Deduplicating request:', url);
                    return await this.pendingRequests.get(cacheKey);
                }
            }
            
            // Create new request
            const requestPromise = this.executeRequest(url, options, requestId);
            
            // Store pending request for deduplication
            if (this.config.enableDeduplication) {
                this.pendingRequests.set(cacheKey, requestPromise);
            }
            
            const result = await requestPromise;
            
            // Cache successful responses
            if (this.config.enableCache && result.ok) {
                const ttl = options.cacheTTL || this.config.defaultCacheTTL;
                this.setCache(cacheKey, result, ttl);
            }
            
            this.recordMetric('request_success', performance.now() - startTime);
            return result;
            
        } catch (error) {
            this.recordMetric('request_error', performance.now() - startTime);
            throw error;
        } finally {
            // Clean up pending request
            this.pendingRequests.delete(cacheKey);
        }
    }
    
    /**
     * Execute actual HTTP request
     */
    async executeRequest(url, options, requestId) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, options.timeout || 30000);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Clone response for caching
            const clonedResponse = response.clone();
            
            return {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                data: await response.json().catch(() => response.text()),
                requestId,
                timestamp: Date.now()
            };
            
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    /**
     * Batch multiple requests
     */
    async batchRequests(requests, options = {}) {
        const { concurrency = 5, delay = 0 } = options;
        const results = [];
        
        for (let i = 0; i < requests.length; i += concurrency) {
            const batch = requests.slice(i, i + concurrency);
            
            const batchPromises = batch.map(async (request, index) => {
                if (delay > 0 && index > 0) {
                    await this.sleep(delay);
                }
                return this.optimizedFetch(request.url, request.options);
            });
            
            const batchResults = await Promise.allSettled(batchPromises);
            results.push(...batchResults);
            
            // Small delay between batches
            if (i + concurrency < requests.length && delay > 0) {
                await this.sleep(delay);
            }
        }
        
        return results;
    }
    
    /**
     * Debounced function executor
     */
    debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }
    
    /**
     * Throttled function executor
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * Lazy loading utility
     */
    createLazyLoader(selector, callback, options = {}) {
        const defaultOptions = {
            root: null,
            rootMargin: '50px',
            threshold: 0.1
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    callback(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { ...defaultOptions, ...options });
        
        document.querySelectorAll(selector).forEach(el => {
            observer.observe(el);
        });
        
        return observer;
    }
    
    /**
     * Virtual scrolling implementation
     */
    createVirtualScroller(container, items, renderItem, itemHeight = 50) {
        const containerHeight = container.clientHeight;
        const visibleCount = Math.ceil(containerHeight / itemHeight) + 2;
        let scrollTop = 0;
        let startIndex = 0;
        
        const render = () => {
            const endIndex = Math.min(startIndex + visibleCount, items.length);
            const visibleItems = items.slice(startIndex, endIndex);
            
            container.innerHTML = '';
            container.style.height = `${items.length * itemHeight}px`;
            container.style.paddingTop = `${startIndex * itemHeight}px`;
            
            visibleItems.forEach((item, index) => {
                const element = renderItem(item, startIndex + index);
                container.appendChild(element);
            });
        };
        
        const onScroll = this.throttle(() => {
            scrollTop = container.scrollTop;
            const newStartIndex = Math.floor(scrollTop / itemHeight);
            
            if (newStartIndex !== startIndex) {
                startIndex = newStartIndex;
                render();
            }
        }, 16); // ~60fps
        
        container.addEventListener('scroll', onScroll);
        render();
        
        return {
            update: (newItems) => {
                items = newItems;
                render();
            },
            destroy: () => {
                container.removeEventListener('scroll', onScroll);
            }
        };
    }
    
    /**
     * Cache management
     */
    setCache(key, value, ttl = this.config.defaultCacheTTL) {
        // Clean up if cache is too large
        if (this.cache.size >= this.config.maxCacheSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl
        });
    }
    
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) {
            this.metrics.cacheMisses++;
            return null;
        }
        
        // Check if expired
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            this.metrics.cacheMisses++;
            return null;
        }
        
        this.metrics.cacheHits++;
        return cached.value;
    }
    
    cleanupCache() {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp > cached.ttl) {
                this.cache.delete(key);
            }
        }
    }
    
    clearCache() {
        this.cache.clear();
        console.log('🧹 Cache cleared');
    }
    
    /**
     * Performance monitoring
     */
    setupPerformanceObserver() {
        if ('PerformanceObserver' in window) {
            this.observers.performance = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    this.recordPerformanceEntry(entry);
                });
            });
            
            try {
                this.observers.performance.observe({ entryTypes: ['navigation', 'resource', 'measure'] });
            } catch (error) {
                console.warn('Performance Observer not fully supported:', error);
            }
        }
    }
    
    setupIntersectionObserver() {
        // Monitor visibility of key elements
        this.observers.intersection = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.recordMetric('element_visible', 0, {
                        element: entry.target.tagName,
                        id: entry.target.id,
                        class: entry.target.className
                    });
                }
            });
        });
    }
    
    recordMetric(type, duration, metadata = {}) {
        if (!this.config.enableMetrics) return;
        
        const metric = {
            type,
            duration,
            timestamp: Date.now(),
            metadata
        };
        
        this.metrics.requests.push(metric);
        this.metrics.totalRequests++;
        
        // Keep metrics history manageable
        if (this.metrics.requests.length > this.config.maxMetricsHistory) {
            this.metrics.requests.shift();
        }
        
        // Update averages
        this.updateAverages();
        
        // Log slow operations
        if (duration > this.config.performanceThreshold) {
            console.warn(`🐌 Slow operation detected: ${type} took ${duration.toFixed(2)}ms`);
        }
    }
    
    recordPerformanceEntry(entry) {
        this.recordMetric('performance_entry', entry.duration, {
            name: entry.name,
            entryType: entry.entryType,
            startTime: entry.startTime
        });
    }
    
    updateAverages() {
        const recentRequests = this.metrics.requests.slice(-100); // Last 100 requests
        const totalDuration = recentRequests.reduce((sum, req) => sum + req.duration, 0);
        this.metrics.averageResponseTime = totalDuration / recentRequests.length || 0;
    }
    
    startMetricsCollection() {
        // Collect basic performance metrics
        setInterval(() => {
            const memory = performance.memory;
            if (memory) {
                this.recordMetric('memory_usage', 0, {
                    used: memory.usedJSHeapSize,
                    total: memory.totalJSHeapSize,
                    limit: memory.jsHeapSizeLimit
                });
            }
        }, 30000); // Every 30 seconds
    }
    
    /**
     * Utility methods
     */
    generateCacheKey(url, options) {
        const key = `${options.method || 'GET'}_${url}`;
        if (options.body) {
            key += `_${JSON.stringify(options.body)}`;
        }
        return key;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    logPerformanceSummary() {
        const cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100 || 0;
        
        console.group('📊 Performance Summary');
        console.log(`Total Requests: ${this.metrics.totalRequests}`);
        console.log(`Average Response Time: ${this.metrics.averageResponseTime.toFixed(2)}ms`);
        console.log(`Cache Hit Rate: ${cacheHitRate.toFixed(1)}%`);
        console.log(`Cache Size: ${this.cache.size}/${this.config.maxCacheSize}`);
        console.log(`Pending Requests: ${this.pendingRequests.size}`);
        console.groupEnd();
    }
    
    /**
     * Get performance statistics
     */
    getStats() {
        const cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100 || 0;
        
        return {
            requests: {
                total: this.metrics.totalRequests,
                average: this.metrics.averageResponseTime,
                errors: this.metrics.errors
            },
            cache: {
                size: this.cache.size,
                maxSize: this.config.maxCacheSize,
                hitRate: cacheHitRate,
                hits: this.metrics.cacheHits,
                misses: this.metrics.cacheMisses
            },
            pending: this.pendingRequests.size,
            memory: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null
        };
    }
    
    /**
     * Start monitoring (called by AppController)
     */
    startMonitoring() {
        console.log('🚀 Performance monitoring started');
        
        // Already initialized in constructor, but we can add additional monitoring here
        if (!this.config.enableMetrics) {
            this.config.enableMetrics = true;
            this.setupPerformanceObserver();
            this.setupIntersectionObserver();
            this.startMetricsCollection();
        }
        
        // Monitor page load performance
        if (document.readyState === 'complete') {
            this.recordPageLoadMetrics();
        } else {
            window.addEventListener('load', () => {
                this.recordPageLoadMetrics();
            });
        }
        
        return this;
    }
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        console.log('🛑 Performance monitoring stopped');
        
        if (this.observers.performance) {
            this.observers.performance.disconnect();
        }
        if (this.observers.intersection) {
            this.observers.intersection.disconnect();
        }
        
        this.config.enableMetrics = false;
        return this;
    }
    
    /**
     * Record page load metrics
     */
    recordPageLoadMetrics() {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
            this.recordMetric('page_load', navigation.loadEventEnd - navigation.fetchStart, {
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
                firstPaint: navigation.responseEnd - navigation.fetchStart,
                type: 'navigation'
            });
        }
    }
    
    /**
     * Configuration methods
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    
    getConfig() {
        return { ...this.config };
    }
}

// Create global performance optimizer instance
window.performanceOptimizer = new PerformanceOptimizer();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceOptimizer;
}