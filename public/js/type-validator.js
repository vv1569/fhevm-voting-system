/**
 * Type Safety and Validation System
 * Provides input validation, type checking, and interface definitions
 */

class TypeValidator {
    constructor() {
        this.schemas = new Map();
        this.customValidators = new Map();
        
        // Built-in type validators
        this.builtInTypes = {
            string: (value) => typeof value === 'string',
            number: (value) => typeof value === 'number' && !isNaN(value),
            boolean: (value) => typeof value === 'boolean',
            object: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
            array: (value) => Array.isArray(value),
            function: (value) => typeof value === 'function',
            undefined: (value) => typeof value === 'undefined',
            null: (value) => value === null,
            date: (value) => value instanceof Date && !isNaN(value.getTime()),
            email: (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            url: (value) => {
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            },
            ethereum_address: (value) => typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value),
            positive_number: (value) => typeof value === 'number' && value > 0,
            non_negative_number: (value) => typeof value === 'number' && value >= 0,
            integer: (value) => typeof value === 'number' && Number.isInteger(value),
            uuid: (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
        };
        
        this.initializeCommonSchemas();
    }
    
    /**
     * Initialize common validation schemas
     */
    initializeCommonSchemas() {
        // User info schema
        this.defineSchema('UserInfo', {
            address: { type: 'ethereum_address', required: true },
            isOwner: { type: 'boolean', required: true },
            isAuthorizedVoter: { type: 'boolean', required: true },
            balance: { type: 'non_negative_number', required: false }
        });
        
        // Proposal schema
        this.defineSchema('Proposal', {
            id: { type: 'positive_number', required: true },
            title: { type: 'string', required: true, minLength: 1, maxLength: 200 },
            description: { type: 'string', required: true, minLength: 1, maxLength: 2000 },
            creator: { type: 'ethereum_address', required: true },
            creationTime: { type: 'positive_number', required: true },
            endTime: { type: 'positive_number', required: true },
            isActive: { type: 'boolean', required: true },
            isFinalized: { type: 'boolean', required: true },
            yesVotes: { type: 'non_negative_number', required: true },
            noVotes: { type: 'non_negative_number', required: true },
            totalVotes: { type: 'non_negative_number', required: true }
        });
        
        // Vote schema
        this.defineSchema('Vote', {
            proposalId: { type: 'positive_number', required: true },
            vote: { type: 'boolean', required: true },
            voter: { type: 'ethereum_address', required: true },
            timestamp: { type: 'positive_number', required: true }
        });
        
        // Configuration schema
        this.defineSchema('Config', {
            chainId: { type: 'positive_number', required: true },
            rpcUrl: { type: 'url', required: true },
            contractAddress: { type: 'ethereum_address', required: true },
            gatewayUrl: { type: 'url', required: false },
            environment: { type: 'string', required: true, enum: ['development', 'testnet', 'mainnet'] }
        });
        
        // Network info schema
        this.defineSchema('NetworkInfo', {
            chainId: { type: 'positive_number', required: true },
            name: { type: 'string', required: true },
            currency: { type: 'string', required: true },
            rpcUrl: { type: 'url', required: true },
            blockExplorer: { type: 'url', required: false }
        });
    }
    
    /**
     * Define a validation schema
     */
    defineSchema(name, schema) {
        this.schemas.set(name, schema);
    }
    
    /**
     * Get a defined schema
     */
    getSchema(name) {
        return this.schemas.get(name);
    }
    
    /**
     * Register custom validator
     */
    registerValidator(name, validator) {
        if (typeof validator !== 'function') {
            throw new Error('Validator must be a function');
        }
        this.customValidators.set(name, validator);
    }
    
    /**
     * Validate value against type
     */
    validateType(value, type) {
        // Check built-in types
        if (this.builtInTypes[type]) {
            return this.builtInTypes[type](value);
        }
        
        // Check custom validators
        if (this.customValidators.has(type)) {
            return this.customValidators.get(type)(value);
        }
        
        throw new Error(`Unknown type: ${type}`);
    }
    
    /**
     * Validate object against schema
     */
    validate(data, schemaOrName) {
        let schema;
        
        if (typeof schemaOrName === 'string') {
            schema = this.schemas.get(schemaOrName);
            if (!schema) {
                throw new Error(`Schema not found: ${schemaOrName}`);
            }
        } else {
            schema = schemaOrName;
        }
        
        const errors = [];
        const warnings = [];
        
        // Check required fields
        for (const [field, rules] of Object.entries(schema)) {
            const value = data[field];
            const fieldPath = field;
            
            // Check if required field is missing
            if (rules.required && (value === undefined || value === null)) {
                errors.push({
                    field: fieldPath,
                    message: `Field '${field}' is required`,
                    code: 'REQUIRED_FIELD_MISSING'
                });
                continue;
            }
            
            // Skip validation if field is not present and not required
            if (value === undefined || value === null) {
                continue;
            }
            
            // Type validation
            if (rules.type && !this.validateType(value, rules.type)) {
                errors.push({
                    field: fieldPath,
                    message: `Field '${field}' must be of type '${rules.type}'`,
                    code: 'INVALID_TYPE',
                    expected: rules.type,
                    actual: typeof value
                });
                continue;
            }
            
            // Additional validations
            const fieldErrors = this.validateFieldRules(value, rules, fieldPath);
            errors.push(...fieldErrors.errors);
            warnings.push(...fieldErrors.warnings);
        }
        
        // Check for unexpected fields
        for (const field of Object.keys(data)) {
            if (!schema[field]) {
                warnings.push({
                    field,
                    message: `Unexpected field '${field}'`,
                    code: 'UNEXPECTED_FIELD'
                });
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            data: this.sanitizeData(data, schema)
        };
    }
    
    /**
     * Validate field-specific rules
     */
    validateFieldRules(value, rules, fieldPath) {
        const errors = [];
        const warnings = [];
        
        // String validations
        if (typeof value === 'string') {
            if (rules.minLength !== undefined && value.length < rules.minLength) {
                errors.push({
                    field: fieldPath,
                    message: `Field '${fieldPath}' must be at least ${rules.minLength} characters long`,
                    code: 'MIN_LENGTH_VIOLATION'
                });
            }
            
            if (rules.maxLength !== undefined && value.length > rules.maxLength) {
                errors.push({
                    field: fieldPath,
                    message: `Field '${fieldPath}' must be at most ${rules.maxLength} characters long`,
                    code: 'MAX_LENGTH_VIOLATION'
                });
            }
            
            if (rules.pattern && !rules.pattern.test(value)) {
                errors.push({
                    field: fieldPath,
                    message: `Field '${fieldPath}' does not match required pattern`,
                    code: 'PATTERN_MISMATCH'
                });
            }
        }
        
        // Number validations
        if (typeof value === 'number') {
            if (rules.min !== undefined && value < rules.min) {
                errors.push({
                    field: fieldPath,
                    message: `Field '${fieldPath}' must be at least ${rules.min}`,
                    code: 'MIN_VALUE_VIOLATION'
                });
            }
            
            if (rules.max !== undefined && value > rules.max) {
                errors.push({
                    field: fieldPath,
                    message: `Field '${fieldPath}' must be at most ${rules.max}`,
                    code: 'MAX_VALUE_VIOLATION'
                });
            }
        }
        
        // Array validations
        if (Array.isArray(value)) {
            if (rules.minItems !== undefined && value.length < rules.minItems) {
                errors.push({
                    field: fieldPath,
                    message: `Field '${fieldPath}' must have at least ${rules.minItems} items`,
                    code: 'MIN_ITEMS_VIOLATION'
                });
            }
            
            if (rules.maxItems !== undefined && value.length > rules.maxItems) {
                errors.push({
                    field: fieldPath,
                    message: `Field '${fieldPath}' must have at most ${rules.maxItems} items`,
                    code: 'MAX_ITEMS_VIOLATION'
                });
            }
            
            // Validate array items
            if (rules.items) {
                value.forEach((item, index) => {
                    const itemPath = `${fieldPath}[${index}]`;
                    if (rules.items.type && !this.validateType(item, rules.items.type)) {
                        errors.push({
                            field: itemPath,
                            message: `Item at ${itemPath} must be of type '${rules.items.type}'`,
                            code: 'INVALID_ITEM_TYPE'
                        });
                    }
                });
            }
        }
        
        // Enum validation
        if (rules.enum && !rules.enum.includes(value)) {
            errors.push({
                field: fieldPath,
                message: `Field '${fieldPath}' must be one of: ${rules.enum.join(', ')}`,
                code: 'ENUM_VIOLATION',
                allowedValues: rules.enum
            });
        }
        
        // Custom validation function
        if (rules.validate && typeof rules.validate === 'function') {
            try {
                const customResult = rules.validate(value);
                if (customResult !== true) {
                    errors.push({
                        field: fieldPath,
                        message: customResult || `Field '${fieldPath}' failed custom validation`,
                        code: 'CUSTOM_VALIDATION_FAILED'
                    });
                }
            } catch (error) {
                errors.push({
                    field: fieldPath,
                    message: `Custom validation error: ${error.message}`,
                    code: 'CUSTOM_VALIDATION_ERROR'
                });
            }
        }
        
        return { errors, warnings };
    }
    
    /**
     * Sanitize data according to schema
     */
    sanitizeData(data, schema) {
        const sanitized = {};
        
        for (const [field, rules] of Object.entries(schema)) {
            let value = data[field];
            
            if (value === undefined || value === null) {
                if (rules.default !== undefined) {
                    value = typeof rules.default === 'function' ? rules.default() : rules.default;
                } else {
                    continue;
                }
            }
            
            // Type coercion
            if (rules.coerce) {
                value = this.coerceValue(value, rules.type);
            }
            
            // Sanitization
            if (rules.sanitize && typeof rules.sanitize === 'function') {
                value = rules.sanitize(value);
            }
            
            sanitized[field] = value;
        }
        
        return sanitized;
    }
    
    /**
     * Coerce value to specified type
     */
    coerceValue(value, type) {
        switch (type) {
            case 'string':
                return String(value);
            case 'number':
                const num = Number(value);
                return isNaN(num) ? value : num;
            case 'boolean':
                if (typeof value === 'string') {
                    return value.toLowerCase() === 'true';
                }
                return Boolean(value);
            case 'date':
                if (typeof value === 'string' || typeof value === 'number') {
                    const date = new Date(value);
                    return isNaN(date.getTime()) ? value : date;
                }
                return value;
            default:
                return value;
        }
    }
    
    /**
     * Create type-safe wrapper for functions
     */
    createTypeSafeWrapper(fn, inputSchema, outputSchema = null) {
        return (...args) => {
            // Validate input
            if (inputSchema) {
                const inputValidation = this.validate(args[0], inputSchema);
                if (!inputValidation.isValid) {
                    throw new Error(`Input validation failed: ${inputValidation.errors.map(e => e.message).join(', ')}`);
                }
            }
            
            // Execute function
            const result = fn(...args);
            
            // Validate output if it's a Promise
            if (result instanceof Promise) {
                return result.then(output => {
                    if (outputSchema) {
                        const outputValidation = this.validate(output, outputSchema);
                        if (!outputValidation.isValid) {
                            throw new Error(`Output validation failed: ${outputValidation.errors.map(e => e.message).join(', ')}`);
                        }
                        return outputValidation.data;
                    }
                    return output;
                });
            }
            
            // Validate synchronous output
            if (outputSchema) {
                const outputValidation = this.validate(result, outputSchema);
                if (!outputValidation.isValid) {
                    throw new Error(`Output validation failed: ${outputValidation.errors.map(e => e.message).join(', ')}`);
                }
                return outputValidation.data;
            }
            
            return result;
        };
    }
    
    /**
     * Validate multiple objects
     */
    validateBatch(dataArray, schema) {
        return dataArray.map((data, index) => {
            const result = this.validate(data, schema);
            return {
                index,
                ...result
            };
        });
    }
    
    /**
     * Get validation summary
     */
    getValidationSummary(validationResults) {
        const total = validationResults.length;
        const valid = validationResults.filter(r => r.isValid).length;
        const invalid = total - valid;
        
        const allErrors = validationResults.flatMap(r => r.errors || []);
        const errorsByCode = allErrors.reduce((acc, error) => {
            acc[error.code] = (acc[error.code] || 0) + 1;
            return acc;
        }, {});
        
        return {
            total,
            valid,
            invalid,
            validPercentage: (valid / total * 100).toFixed(1),
            errorsByCode,
            mostCommonError: Object.entries(errorsByCode).sort(([,a], [,b]) => b - a)[0]?.[0] || null
        };
    }
    
    /**
     * Utility methods
     */
    isValidEthereumAddress(address) {
        return this.validateType(address, 'ethereum_address');
    }
    
    isValidEmail(email) {
        return this.validateType(email, 'email');
    }
    
    isValidUrl(url) {
        return this.validateType(url, 'url');
    }
    
    /**
     * Get all available types
     */
    getAvailableTypes() {
        return {
            builtIn: Object.keys(this.builtInTypes),
            custom: Array.from(this.customValidators.keys())
        };
    }
    
    /**
     * Get all defined schemas
     */
    getDefinedSchemas() {
        return Array.from(this.schemas.keys());
    }
}

// Create global type validator instance
window.typeValidator = new TypeValidator();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TypeValidator;
}