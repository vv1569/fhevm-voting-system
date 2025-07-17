/**
 * Cache Management System
 * Provides intelligent caching, expiration management, and storage optimization
 */

class CacheManager {
    constructor(options = {}) {
        this.options = {
            defaultTTL: options.defaultTTL || 5 * 60 * 1000, // 5 minutes
            maxSize: options.maxSize || 100, // Maximum number of cache entries
            storageType: options.storageType || 'memory', // 'memory', 'localStorage', 'sessionStorage'
            compressionEnabled: options.compressionEnabled || false,
            encryptionEnabled: options.encryptionEnabled || false,
            persistentKeys: options.persistentKeys || [], // Keys that should persist across sessions
            ...options
        };
        
        this.cache = new Map();
        this.timers = new Map();
        this.accessTimes = new Map();
        this.hitCount = new Map();
        this.statistics = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0,
            totalSize: 0
        };
        
        this.initializeStorage();
        this.startCleanupInterval();
        
        // Bind methods to preserve context
        this.get = this.get.bind(this);
        this.set = this.set.bind(this);
        this.delete = this.delete.bind(this);
        this.clear = this.clear.bind(this);
    }
    
    /**
     * Initialize storage based on type
     */
    initializeStorage() {
        if (this.options.storageType === 'localStorage' || this.options.storageType === 'sessionStorage') {
            this.loadFromStorage();
        }
        
        // Listen for storage events
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                this.saveToStorage();
            });
            
            window.addEventListener('storage', (e) => {
                if (e.key && e.key.startsWith('cache_')) {
                    this.handleStorageChange(e);
                }
            });
        }
    }
    
    /**
     * Get value from cache
     */
    get(key, options = {}) {
        const cacheKey = this.normalizeKey(key);
        const entry = this.cache.get(cacheKey);
        
        if (!entry) {
            this.statistics.misses++;
            return options.defaultValue || null;
        }
        
        // Check if expired
        if (this.isExpired(entry)) {
            this.delete(key);
            this.statistics.misses++;
            return options.defaultValue || null;
        }
        
        // Update access statistics
        this.accessTimes.set(cacheKey, Date.now());
        this.hitCount.set(cacheKey, (this.hitCount.get(cacheKey) || 0) + 1);
        this.statistics.hits++;
        
        // Return cloned data to prevent mutations
        return this.cloneData(entry.data);
    }
    
    /**
     * Set value in cache
     */
    set(key, value, options = {}) {
        const cacheKey = this.normalizeKey(key);
        const ttl = options.ttl || this.options.defaultTTL;
        const priority = options.priority || 'normal'; // 'low', 'normal', 'high'
        const tags = options.tags || [];
        
        // Check cache size and evict if necessary
        if (this.cache.size >= this.options.maxSize && !this.cache.has(cacheKey)) {
            this.evictLeastUsed();
        }
        
        // Clear existing timer
        if (this.timers.has(cacheKey)) {
            clearTimeout(this.timers.get(cacheKey));
        }
        
        // Create cache entry
        const entry = {
            data: this.cloneData(value),
            timestamp: Date.now(),
            ttl: ttl,
            expiresAt: Date.now() + ttl,
            priority: priority,
            tags: tags,
            size: this.calculateSize(value),
            compressed: false,
            encrypted: false
        };
        
        // Apply compression if enabled
        if (this.options.compressionEnabled && entry.size > 1024) {
            entry.data = this.compress(entry.data);
            entry.compressed = true;
        }
        
        // Apply encryption if enabled
        if (this.options.encryptionEnabled) {
            entry.data = this.encrypt(entry.data);
            entry.encrypted = true;
        }
        
        // Set cache entry
        this.cache.set(cacheKey, entry);
        this.accessTimes.set(cacheKey, Date.now());
        this.hitCount.set(cacheKey, 0);
        
        // Set expiration timer
        if (ttl > 0) {
            const timer = setTimeout(() => {
                this.delete(key);
            }, ttl);
            this.timers.set(cacheKey, timer);
        }
        
        this.statistics.sets++;
        this.statistics.totalSize += entry.size;
        
        // Save to persistent storage if needed
        if (this.options.persistentKeys.includes(key)) {
            this.saveKeyToStorage(cacheKey, entry);
        }
        
        return true;
    }
    
    /**
     * Delete value from cache
     */
    delete(key) {
        const cacheKey = this.normalizeKey(key);
        const entry = this.cache.get(cacheKey);
        
        if (!entry) {
            return false;
        }
        
        // Clear timer
        if (this.timers.has(cacheKey)) {
            clearTimeout(this.timers.get(cacheKey));
            this.timers.delete(cacheKey);
        }
        
        // Remove from cache
        this.cache.delete(cacheKey);
        this.accessTimes.delete(cacheKey);
        this.hitCount.delete(cacheKey);
        
        this.statistics.deletes++;
        this.statistics.totalSize -= entry.size;
        
        // Remove from persistent storage
        this.removeKeyFromStorage(cacheKey);
        
        return true;
    }
    
    /**
     * Clear all cache entries
     */
    clear(options = {}) {
        const { tags, pattern } = options;
        
        if (tags && tags.length > 0) {
            // Clear by tags
            for (const [key, entry] of this.cache.entries()) {
                if (entry.tags && entry.tags.some(tag => tags.includes(tag))) {
                    this.delete(this.denormalizeKey(key));
                }
            }
        } else if (pattern) {
            // Clear by pattern
            const regex = new RegExp(pattern);
            for (const key of this.cache.keys()) {
                if (regex.test(this.denormalizeKey(key))) {
                    this.delete(this.denormalizeKey(key));
                }
            }
        } else {
            // Clear all
            for (const timer of this.timers.values()) {
                clearTimeout(timer);
            }
            
            this.cache.clear();
            this.timers.clear();
            this.accessTimes.clear();
            this.hitCount.clear();
            
            this.statistics.totalSize = 0;
            
            // Clear persistent storage
            this.clearStorage();
        }
    }
    
    /**
     * Check if key exists and is not expired
     */
    has(key) {
        const cacheKey = this.normalizeKey(key);
        const entry = this.cache.get(cacheKey);
        
        if (!entry) {
            return false;
        }
        
        if (this.isExpired(entry)) {
            this.delete(key);
            return false;
        }
        
        return true;
    }
    
    /**
     * Get multiple values at once
     */
    getMultiple(keys) {
        const result = {};
        
        for (const key of keys) {
            result[key] = this.get(key);
        }
        
        return result;
    }
    
    /**
     * Set multiple values at once
     */
    setMultiple(entries, options = {}) {
        const results = {};
        
        for (const [key, value] of Object.entries(entries)) {
            results[key] = this.set(key, value, options);
        }
        
        return results;
    }
    
    /**
     * Get or set pattern (cache-aside)
     */
    async getOrSet(key, factory, options = {}) {
        let value = this.get(key);
        
        if (value === null) {
            try {
                value = await factory();
                if (value !== null && value !== undefined) {
                    this.set(key, value, options);
                }
            } catch (error) {
                console.error('Cache factory function failed:', error);
                throw error;
            }
        }
        
        return value;
    }
    
    /**
     * Extend TTL for existing entry
     */
    touch(key, additionalTTL) {
        const cacheKey = this.normalizeKey(key);
        const entry = this.cache.get(cacheKey);
        
        if (!entry || this.isExpired(entry)) {
            return false;
        }
        
        // Update expiration
        entry.expiresAt = Date.now() + (additionalTTL || entry.ttl);
        
        // Reset timer
        if (this.timers.has(cacheKey)) {
            clearTimeout(this.timers.get(cacheKey));
        }
        
        const timer = setTimeout(() => {
            this.delete(key);
        }, additionalTTL || entry.ttl);
        
        this.timers.set(cacheKey, timer);
        
        return true;
    }
    
    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate = this.statistics.hits + this.statistics.misses > 0 
            ? (this.statistics.hits / (this.statistics.hits + this.statistics.misses) * 100).toFixed(2)
            : 0;
        
        return {
            ...this.statistics,
            hitRate: `${hitRate}%`,
            size: this.cache.size,
            maxSize: this.options.maxSize,
            memoryUsage: this.getMemoryUsage(),
            oldestEntry: this.getOldestEntry(),
            mostAccessedEntry: this.getMostAccessedEntry()
        };
    }
    
    /**
     * Get memory usage information
     */
    getMemoryUsage() {
        let totalSize = 0;
        let compressedSize = 0;
        
        for (const entry of this.cache.values()) {
            totalSize += entry.size;
            if (entry.compressed) {
                compressedSize += entry.size;
            }
        }
        
        return {
            totalSize,
            compressedSize,
            compressionRatio: compressedSize > 0 ? ((totalSize - compressedSize) / totalSize * 100).toFixed(2) + '%' : '0%'
        };
    }
    
    /**
     * Get all cache keys
     */
    keys(pattern) {
        const keys = Array.from(this.cache.keys()).map(key => this.denormalizeKey(key));
        
        if (pattern) {
            const regex = new RegExp(pattern);
            return keys.filter(key => regex.test(key));
        }
        
        return keys;
    }
    
    /**
     * Export cache data
     */
    export(options = {}) {
        const { includeExpired = false, format = 'json' } = options;
        const data = {};
        
        for (const [key, entry] of this.cache.entries()) {
            if (!includeExpired && this.isExpired(entry)) {
                continue;
            }
            
            data[this.denormalizeKey(key)] = {
                value: this.decompressAndDecrypt(entry),
                timestamp: entry.timestamp,
                expiresAt: entry.expiresAt,
                tags: entry.tags,
                priority: entry.priority
            };
        }
        
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }
        
        return data;
    }
    
    /**
     * Import cache data
     */
    import(data, options = {}) {
        const { overwrite = false, skipExpired = true } = options;
        let imported = 0;
        let skipped = 0;
        
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        
        for (const [key, entry] of Object.entries(parsedData)) {
            // Skip if key exists and overwrite is false
            if (!overwrite && this.has(key)) {
                skipped++;
                continue;
            }
            
            // Skip expired entries if requested
            if (skipExpired && entry.expiresAt < Date.now()) {
                skipped++;
                continue;
            }
            
            // Calculate remaining TTL
            const remainingTTL = Math.max(0, entry.expiresAt - Date.now());
            
            this.set(key, entry.value, {
                ttl: remainingTTL,
                tags: entry.tags,
                priority: entry.priority
            });
            
            imported++;
        }
        
        return { imported, skipped };
    }
    
    /**
     * Private helper methods
     */
    
    normalizeKey(key) {
        return typeof key === 'string' ? key : JSON.stringify(key);
    }
    
    denormalizeKey(key) {
        try {
            return JSON.parse(key);
        } catch {
            return key;
        }
    }
    
    isExpired(entry) {
        return entry.expiresAt > 0 && Date.now() > entry.expiresAt;
    }
    
    cloneData(data) {
        if (data === null || typeof data !== 'object') {
            return data;
        }
        
        try {
            return JSON.parse(JSON.stringify(data));
        } catch {
            return data;
        }
    }
    
    calculateSize(data) {
        try {
            return JSON.stringify(data).length;
        } catch {
            return 0;
        }
    }
    
    evictLeastUsed() {
        let leastUsedKey = null;
        let leastUsedScore = Infinity;
        
        for (const [key, entry] of this.cache.entries()) {
            const accessTime = this.accessTimes.get(key) || 0;
            const hitCount = this.hitCount.get(key) || 0;
            const priority = entry.priority === 'high' ? 3 : entry.priority === 'normal' ? 2 : 1;
            
            // Calculate score (lower is worse)
            const score = (hitCount + 1) * priority * (accessTime / 1000);
            
            if (score < leastUsedScore) {
                leastUsedScore = score;
                leastUsedKey = key;
            }
        }
        
        if (leastUsedKey) {
            this.delete(this.denormalizeKey(leastUsedKey));
            this.statistics.evictions++;
        }
    }
    
    getOldestEntry() {
        let oldest = null;
        let oldestTime = Infinity;
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldest = this.denormalizeKey(key);
            }
        }
        
        return oldest;
    }
    
    getMostAccessedEntry() {
        let mostAccessed = null;
        let maxHits = 0;
        
        for (const [key, hits] of this.hitCount.entries()) {
            if (hits > maxHits) {
                maxHits = hits;
                mostAccessed = this.denormalizeKey(key);
            }
        }
        
        return { key: mostAccessed, hits: maxHits };
    }
    
    startCleanupInterval() {
        // Clean up expired entries every minute
        setInterval(() => {
            this.cleanupExpired();
        }, 60000);
    }
    
    cleanupExpired() {
        const expiredKeys = [];
        
        for (const [key, entry] of this.cache.entries()) {
            if (this.isExpired(entry)) {
                expiredKeys.push(this.denormalizeKey(key));
            }
        }
        
        for (const key of expiredKeys) {
            this.delete(key);
        }
    }
    
    // Storage methods (simplified - would need actual implementation)
    loadFromStorage() {
        // Implementation would depend on storage type
    }
    
    saveToStorage() {
        // Implementation would depend on storage type
    }
    
    saveKeyToStorage(key, entry) {
        // Implementation would depend on storage type
    }
    
    removeKeyFromStorage(key) {
        // Implementation would depend on storage type
    }
    
    clearStorage() {
        // Implementation would depend on storage type
    }
    
    handleStorageChange(event) {
        // Handle external storage changes
    }
    
    // Compression methods (simplified)
    compress(data) {
        // Would use actual compression library
        return data;
    }
    
    decompress(data) {
        // Would use actual compression library
        return data;
    }
    
    // Encryption methods (simplified)
    encrypt(data) {
        // Would use actual encryption
        return data;
    }
    
    decrypt(data) {
        // Would use actual decryption
        return data;
    }
    
    decompressAndDecrypt(entry) {
        let data = entry.data;
        
        if (entry.encrypted) {
            data = this.decrypt(data);
        }
        
        if (entry.compressed) {
            data = this.decompress(data);
        }
        
        return data;
    }
}

// Create global cache manager instance
window.cacheManager = new CacheManager({
    defaultTTL: 10 * 60 * 1000, // 10 minutes
    maxSize: 200,
    storageType: 'memory'
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheManager;
}