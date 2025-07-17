/**
 * Build Optimization Script
 * Provides code minification, dependency analysis, and performance optimization
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class BuildOptimizer {
    constructor(options = {}) {
        this.options = {
            sourceDir: options.sourceDir || './public',
            outputDir: options.outputDir || './dist',
            minify: options.minify !== false,
            generateSourceMaps: options.generateSourceMaps !== false,
            bundleModules: options.bundleModules !== false,
            optimizeImages: options.optimizeImages !== false,
            generateManifest: options.generateManifest !== false,
            ...options
        };
        
        this.stats = {
            filesProcessed: 0,
            totalSizeOriginal: 0,
            totalSizeOptimized: 0,
            compressionRatio: 0,
            buildTime: 0
        };
        
        this.dependencies = new Map();
        this.moduleGraph = new Map();
    }
    
    /**
     * Main build process
     */
    async build() {
        const startTime = Date.now();
        
        console.log('🚀 Starting build optimization...');
        
        try {
            // Clean output directory
            await this.cleanOutputDir();
            
            // Analyze dependencies
            await this.analyzeDependencies();
            
            // Process files
            await this.processFiles();
            
            // Bundle modules if enabled
            if (this.options.bundleModules) {
                await this.bundleModules();
            }
            
            // Optimize images if enabled
            if (this.options.optimizeImages) {
                await this.optimizeImages();
            }
            
            // Generate manifest if enabled
            if (this.options.generateManifest) {
                await this.generateManifest();
            }
            
            // Generate build report
            this.stats.buildTime = Date.now() - startTime;
            this.stats.compressionRatio = this.stats.totalSizeOriginal > 0 
                ? ((this.stats.totalSizeOriginal - this.stats.totalSizeOptimized) / this.stats.totalSizeOriginal * 100)
                : 0;
            
            await this.generateBuildReport();
            
            console.log('✅ Build optimization completed successfully!');
            console.log(`📊 Processed ${this.stats.filesProcessed} files`);
            console.log(`📉 Size reduction: ${this.stats.compressionRatio.toFixed(2)}%`);
            console.log(`⏱️  Build time: ${this.stats.buildTime}ms`);
            
        } catch (error) {
            console.error('❌ Build optimization failed:', error);
            throw error;
        }
    }
    
    /**
     * Clean output directory
     */
    async cleanOutputDir() {
        if (fs.existsSync(this.options.outputDir)) {
            await this.removeDirectory(this.options.outputDir);
        }
        fs.mkdirSync(this.options.outputDir, { recursive: true });
    }
    
    /**
     * Analyze dependencies
     */
    async analyzeDependencies() {
        console.log('🔍 Analyzing dependencies...');
        
        const jsFiles = await this.findFiles(this.options.sourceDir, '.js');
        
        for (const file of jsFiles) {
            const content = fs.readFileSync(file, 'utf8');
            const deps = this.extractDependencies(content);
            this.dependencies.set(file, deps);
        }
        
        // Build module graph
        this.buildModuleGraph();
        
        console.log(`📦 Found ${this.dependencies.size} modules with dependencies`);
    }
    
    /**
     * Extract dependencies from JavaScript content
     */
    extractDependencies(content) {
        const dependencies = [];
        
        // Extract script src dependencies
        const scriptMatches = content.match(/<script[^>]+src=["']([^"']+)["'][^>]*>/g) || [];
        for (const match of scriptMatches) {
            const srcMatch = match.match(/src=["']([^"']+)["']/);
            if (srcMatch) {
                dependencies.push({
                    type: 'script',
                    path: srcMatch[1],
                    async: match.includes('async'),
                    defer: match.includes('defer')
                });
            }
        }
        
        // Extract CSS dependencies
        const cssMatches = content.match(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/g) || [];
        for (const match of cssMatches) {
            const hrefMatch = match.match(/href=["']([^"']+)["']/);
            if (hrefMatch) {
                dependencies.push({
                    type: 'css',
                    path: hrefMatch[1]
                });
            }
        }
        
        // Extract import statements
        const importMatches = content.match(/import\s+.*?from\s+["']([^"']+)["']/g) || [];
        for (const match of importMatches) {
            const pathMatch = match.match(/from\s+["']([^"']+)["']/);
            if (pathMatch) {
                dependencies.push({
                    type: 'import',
                    path: pathMatch[1]
                });
            }
        }
        
        // Extract require statements
        const requireMatches = content.match(/require\(["']([^"']+)["']\)/g) || [];
        for (const match of requireMatches) {
            const pathMatch = match.match(/require\(["']([^"']+)["']\)/);
            if (pathMatch) {
                dependencies.push({
                    type: 'require',
                    path: pathMatch[1]
                });
            }
        }
        
        return dependencies;
    }
    
    /**
     * Build module dependency graph
     */
    buildModuleGraph() {
        for (const [file, deps] of this.dependencies.entries()) {
            const moduleName = path.basename(file, '.js');
            this.moduleGraph.set(moduleName, {
                file,
                dependencies: deps,
                dependents: []
            });
        }
        
        // Build reverse dependencies
        for (const [moduleName, module] of this.moduleGraph.entries()) {
            for (const dep of module.dependencies) {
                const depName = path.basename(dep.path, '.js');
                const depModule = this.moduleGraph.get(depName);
                if (depModule) {
                    depModule.dependents.push(moduleName);
                }
            }
        }
    }
    
    /**
     * Process all files
     */
    async processFiles() {
        console.log('⚙️  Processing files...');
        
        const files = await this.getAllFiles(this.options.sourceDir);
        
        for (const file of files) {
            await this.processFile(file);
        }
    }
    
    /**
     * Process individual file
     */
    async processFile(filePath) {
        const relativePath = path.relative(this.options.sourceDir, filePath);
        const outputPath = path.join(this.options.outputDir, relativePath);
        const ext = path.extname(filePath).toLowerCase();
        
        // Ensure output directory exists
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        
        const originalSize = fs.statSync(filePath).size;
        this.stats.totalSizeOriginal += originalSize;
        
        let content = fs.readFileSync(filePath, 'utf8');
        let processedContent = content;
        
        // Process based on file type
        switch (ext) {
            case '.js':
                processedContent = await this.processJavaScript(content, filePath);
                break;
            case '.css':
                processedContent = await this.processCSS(content);
                break;
            case '.html':
                processedContent = await this.processHTML(content);
                break;
            default:
                // Copy other files as-is
                fs.copyFileSync(filePath, outputPath);
                this.stats.filesProcessed++;
                return;
        }
        
        // Write processed content
        fs.writeFileSync(outputPath, processedContent, 'utf8');
        
        const optimizedSize = Buffer.byteLength(processedContent, 'utf8');
        this.stats.totalSizeOptimized += optimizedSize;
        this.stats.filesProcessed++;
        
        const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
        console.log(`📄 ${relativePath}: ${originalSize} → ${optimizedSize} bytes (${reduction}% reduction)`);
    }
    
    /**
     * Process JavaScript files
     */
    async processJavaScript(content, filePath) {
        let processed = content;
        
        if (this.options.minify) {
            processed = this.minifyJavaScript(processed);
        }
        
        // Add source map comment if enabled
        if (this.options.generateSourceMaps) {
            const mapFile = path.basename(filePath) + '.map';
            processed += `\n//# sourceMappingURL=${mapFile}`;
            
            // Generate source map (simplified)
            const sourceMap = this.generateSourceMap(filePath, content, processed);
            const mapPath = path.join(
                this.options.outputDir,
                path.relative(this.options.sourceDir, filePath) + '.map'
            );
            fs.writeFileSync(mapPath, JSON.stringify(sourceMap, null, 2));
        }
        
        return processed;
    }
    
    /**
     * Minify JavaScript (simplified implementation)
     */
    minifyJavaScript(content) {
        return content
            // Remove single-line comments
            .replace(/\/\/.*$/gm, '')
            // Remove multi-line comments
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            // Remove whitespace around operators
            .replace(/\s*([{}();,=+\-*/<>!&|])\s*/g, '$1')
            // Remove trailing semicolons before }
            .replace(/;}/g, '}')
            .trim();
    }
    
    /**
     * Process CSS files
     */
    async processCSS(content) {
        let processed = content;
        
        if (this.options.minify) {
            processed = this.minifyCSS(processed);
        }
        
        return processed;
    }
    
    /**
     * Minify CSS
     */
    minifyCSS(content) {
        return content
            // Remove comments
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            // Remove whitespace around special characters
            .replace(/\s*([{}:;,>+~])\s*/g, '$1')
            // Remove trailing semicolon before }
            .replace(/;}/g, '}')
            .trim();
    }
    
    /**
     * Process HTML files
     */
    async processHTML(content) {
        let processed = content;
        
        if (this.options.minify) {
            processed = this.minifyHTML(processed);
        }
        
        return processed;
    }
    
    /**
     * Minify HTML
     */
    minifyHTML(content) {
        return content
            // Remove HTML comments (but keep conditional comments)
            .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
            // Remove extra whitespace between tags
            .replace(/>\s+</g, '><')
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    /**
     * Bundle modules
     */
    async bundleModules() {
        console.log('📦 Bundling modules...');
        
        const bundles = this.createBundles();
        
        for (const [bundleName, modules] of bundles.entries()) {
            const bundleContent = await this.createBundle(modules);
            const bundlePath = path.join(this.options.outputDir, 'js', `${bundleName}.bundle.js`);
            
            fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
            fs.writeFileSync(bundlePath, bundleContent, 'utf8');
            
            console.log(`📦 Created bundle: ${bundleName}.bundle.js (${modules.length} modules)`);
        }
    }
    
    /**
     * Create bundle strategy
     */
    createBundles() {
        const bundles = new Map();
        
        // Core bundle (optimization modules)
        bundles.set('core', [
            'state-manager',
            'error-handler',
            'performance-optimizer',
            'type-validator',
            'cache-manager'
        ]);
        
        // App bundle (main application modules)
        bundles.set('app', [
            'config',
            'wallet',
            'contract',
            'ui',
            'app'
        ]);
        
        return bundles;
    }
    
    /**
     * Create bundle content
     */
    async createBundle(moduleNames) {
        let bundleContent = '';
        
        // Add bundle header
        bundleContent += `/* Bundle generated at ${new Date().toISOString()} */\n`;
        bundleContent += `(function() {\n`;
        bundleContent += `'use strict';\n\n`;
        
        // Add modules in dependency order
        const sortedModules = this.sortModulesByDependencies(moduleNames);
        
        for (const moduleName of sortedModules) {
            const module = this.moduleGraph.get(moduleName);
            if (module && fs.existsSync(module.file)) {
                const moduleContent = fs.readFileSync(module.file, 'utf8');
                bundleContent += `/* Module: ${moduleName} */\n`;
                bundleContent += this.wrapModuleContent(moduleContent, moduleName);
                bundleContent += '\n\n';
            }
        }
        
        bundleContent += `})();\n`;
        
        return this.options.minify ? this.minifyJavaScript(bundleContent) : bundleContent;
    }
    
    /**
     * Sort modules by dependencies
     */
    sortModulesByDependencies(moduleNames) {
        const sorted = [];
        const visited = new Set();
        const visiting = new Set();
        
        const visit = (moduleName) => {
            if (visiting.has(moduleName)) {
                throw new Error(`Circular dependency detected: ${moduleName}`);
            }
            
            if (visited.has(moduleName)) {
                return;
            }
            
            visiting.add(moduleName);
            
            const module = this.moduleGraph.get(moduleName);
            if (module) {
                for (const dep of module.dependencies) {
                    const depName = path.basename(dep.path, '.js');
                    if (moduleNames.includes(depName)) {
                        visit(depName);
                    }
                }
            }
            
            visiting.delete(moduleName);
            visited.add(moduleName);
            sorted.push(moduleName);
        };
        
        for (const moduleName of moduleNames) {
            visit(moduleName);
        }
        
        return sorted;
    }
    
    /**
     * Wrap module content for bundling
     */
    wrapModuleContent(content, moduleName) {
        // Simple module wrapper
        return `(function(module, exports, require, window, document) {\n${content}\n})(window.modules['${moduleName}'] = {}, {}, function(){}, window, document);`;
    }
    
    /**
     * Generate source map (simplified)
     */
    generateSourceMap(filePath, originalContent, minifiedContent) {
        return {
            version: 3,
            file: path.basename(filePath),
            sourceRoot: '',
            sources: [path.basename(filePath)],
            sourcesContent: [originalContent],
            names: [],
            mappings: '' // Simplified - would need proper source map generation
        };
    }
    
    /**
     * Optimize images (placeholder)
     */
    async optimizeImages() {
        console.log('🖼️  Optimizing images...');
        // Would implement image optimization here
    }
    
    /**
     * Generate build manifest
     */
    async generateManifest() {
        console.log('📋 Generating build manifest...');
        
        const manifest = {
            buildTime: new Date().toISOString(),
            version: this.generateVersion(),
            files: {},
            dependencies: Object.fromEntries(this.dependencies),
            moduleGraph: Object.fromEntries(this.moduleGraph),
            stats: this.stats
        };
        
        // Add file hashes
        const files = await this.getAllFiles(this.options.outputDir);
        for (const file of files) {
            const relativePath = path.relative(this.options.outputDir, file);
            const content = fs.readFileSync(file);
            const hash = crypto.createHash('md5').update(content).digest('hex');
            
            manifest.files[relativePath] = {
                hash,
                size: content.length
            };
        }
        
        const manifestPath = path.join(this.options.outputDir, 'build-manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }
    
    /**
     * Generate build report
     */
    async generateBuildReport() {
        const report = {
            buildTime: new Date().toISOString(),
            stats: this.stats,
            dependencies: this.analyzeDependencyStats(),
            recommendations: this.generateRecommendations()
        };
        
        const reportPath = path.join(this.options.outputDir, 'build-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        // Generate human-readable report
        const readableReport = this.generateReadableReport(report);
        const readableReportPath = path.join(this.options.outputDir, 'build-report.md');
        fs.writeFileSync(readableReportPath, readableReport);
    }
    
    /**
     * Analyze dependency statistics
     */
    analyzeDependencyStats() {
        const stats = {
            totalModules: this.moduleGraph.size,
            circularDependencies: [],
            unusedModules: [],
            heaviestModules: []
        };
        
        // Find unused modules
        for (const [moduleName, module] of this.moduleGraph.entries()) {
            if (module.dependents.length === 0 && moduleName !== 'app') {
                stats.unusedModules.push(moduleName);
            }
        }
        
        return stats;
    }
    
    /**
     * Generate optimization recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        
        if (this.stats.compressionRatio < 20) {
            recommendations.push({
                type: 'compression',
                message: 'Consider enabling more aggressive minification',
                impact: 'medium'
            });
        }
        
        const unusedModules = this.analyzeDependencyStats().unusedModules;
        if (unusedModules.length > 0) {
            recommendations.push({
                type: 'cleanup',
                message: `Remove unused modules: ${unusedModules.join(', ')}`,
                impact: 'low'
            });
        }
        
        if (this.stats.filesProcessed > 20) {
            recommendations.push({
                type: 'bundling',
                message: 'Consider bundling more modules to reduce HTTP requests',
                impact: 'high'
            });
        }
        
        return recommendations;
    }
    
    /**
     * Generate readable report
     */
    generateReadableReport(report) {
        return `# Build Report\n\n` +
            `**Build Time:** ${report.buildTime}\n\n` +
            `## Statistics\n\n` +
            `- Files Processed: ${report.stats.filesProcessed}\n` +
            `- Original Size: ${(report.stats.totalSizeOriginal / 1024).toFixed(2)} KB\n` +
            `- Optimized Size: ${(report.stats.totalSizeOptimized / 1024).toFixed(2)} KB\n` +
            `- Compression Ratio: ${report.stats.compressionRatio.toFixed(2)}%\n` +
            `- Build Time: ${report.stats.buildTime}ms\n\n` +
            `## Dependencies\n\n` +
            `- Total Modules: ${report.dependencies.totalModules}\n` +
            `- Unused Modules: ${report.dependencies.unusedModules.length}\n\n` +
            `## Recommendations\n\n` +
            report.recommendations.map(rec => `- **${rec.type}**: ${rec.message} (${rec.impact} impact)`).join('\n');
    }
    
    /**
     * Utility methods
     */
    
    async findFiles(dir, extension) {
        const files = [];
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                files.push(...await this.findFiles(fullPath, extension));
            } else if (path.extname(item) === extension) {
                files.push(fullPath);
            }
        }
        
        return files;
    }
    
    async getAllFiles(dir) {
        const files = [];
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                files.push(...await this.getAllFiles(fullPath));
            } else {
                files.push(fullPath);
            }
        }
        
        return files;
    }
    
    async removeDirectory(dir) {
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    await this.removeDirectory(fullPath);
                } else {
                    fs.unlinkSync(fullPath);
                }
            }
            
            fs.rmdirSync(dir);
        }
    }
    
    generateVersion() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `${timestamp}-${random}`;
    }
}

// CLI usage
if (require.main === module) {
    const optimizer = new BuildOptimizer({
        sourceDir: './public',
        outputDir: './dist',
        minify: true,
        generateSourceMaps: true,
        bundleModules: true,
        generateManifest: true
    });
    
    optimizer.build().catch(console.error);
}

module.exports = BuildOptimizer;