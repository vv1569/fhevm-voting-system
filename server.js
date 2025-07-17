const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// 导入自定义模块
const { getSecurityHeaders, getCorsConfig, getRateLimitConfig, inputValidation, securityLogger } = require('./security/security-headers');
const { createMonitor, createPerformanceMiddleware } = require('./monitoring/performance');
const { logger, createLoggerMiddleware } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 创建性能监控实例
const performanceMonitor = createMonitor({
  enabled: process.env.MONITORING_ENABLED !== 'false',
  collectInterval: 30000,
  memoryThreshold: 0.8,
  cpuThreshold: 0.8,
  responseTimeThreshold: 1000
});

// 监听性能警告
performanceMonitor.on('warning', (warning) => {
  logger.warn('Performance warning', warning);
});

performanceMonitor.on('error', (error) => {
  logger.error('Performance monitoring error', error);
});

// Middleware
// 安全中间件
app.use(securityLogger());
app.use(helmet(getSecurityHeaders(NODE_ENV)));
app.use(cors(getCorsConfig(NODE_ENV)));
app.use(rateLimit(getRateLimitConfig(NODE_ENV)));
app.use(inputValidation());

// 性能和日志中间件
app.use(createPerformanceMiddleware(performanceMonitor));
app.use(createLoggerMiddleware(logger));

// 基础中间件
app.use(compression());
app.use(express.json({ 
  limit: process.env.MAX_REQUEST_SIZE || '10mb',
  verify: (req, res, buf) => {
    // 验证 JSON 格式
    try {
      JSON.parse(buf);
    } catch (e) {
      logger.warn('Invalid JSON received', { ip: req.ip, error: e.message });
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_REQUEST_SIZE || '10mb' 
}));

// Static file service (must be before specific routes to allow file serving)
app.use(express.static(path.join(__dirname, 'public')));

// Home route (fallback for SPA routing)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API routes
app.get('/api/health', (req, res) => {
  try {
    const healthStatus = performanceMonitor.getHealthStatus();
    const systemInfo = {
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      nodeEnv: NODE_ENV,
      service: 'FHEVM Voting System',
      ...healthStatus.metrics
    };
    
    logger.debug('Health check requested', { ip: req.ip, status: healthStatus.status });
    
    if (healthStatus.status === 'healthy') {
      res.json(systemInfo);
    } else {
      res.status(503).json({
        ...systemInfo,
        issues: healthStatus.issues
      });
    }
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// 性能指标端点
app.get('/api/metrics', (req, res) => {
  try {
    const metrics = performanceMonitor.getMetrics();
    logger.debug('Metrics requested', { ip: req.ip });
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get metrics', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Configuration information
app.get('/config.json', (req, res) => {
  // Try to load deployment info based on current network
  let contractAddress = process.env.VOTING_CONTRACT_ADDRESS || '';
  const network = process.env.NETWORK || 'localhost';
  
  try {
    const deploymentInfo = require(`./deployments/voting-${network}.json`);
    contractAddress = deploymentInfo.address;
  } catch (error) {
    // Fallback to environment variable or empty string
    console.log(`No deployment file found for network: ${network}, using environment variable`);
  }
  
  // Set network-specific configurations
  let rpcUrl, chainId;
  if (network === 'sepolia') {
    rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID';
    chainId = 11155111;
  } else if (network === 'mainnet') {
    rpcUrl = process.env.MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID';
    chainId = 1;
  } else {
    rpcUrl = process.env.LOCALHOST_RPC_URL || 'http://localhost:8545';
    chainId = 1337;
  }
  
  res.json({
    networkName: network,
    rpcUrl: rpcUrl,
    chainId: chainId,
    contractAddress: contractAddress,
    features: {
      voting: true,
      governance: true,
      privacy: true
    }
  });
});

// Deployment information
app.get('/api/deployments', (req, res) => {
  try {
    const deployments = require('./deployments.json');
    res.json(deployments);
  } catch (error) {
    res.json({ contracts: {} });
  }
});

// Home route is now defined above API routes

// 全局错误处理中间件
app.use((err, req, res, next) => {
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  
  // 记录错误
  logger.error('Unhandled error', {
    errorId,
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // 记录到性能监控
  performanceMonitor.recordError(err, {
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  // 返回错误响应
  const isDevelopment = NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal server error',
    errorId,
    ...(isDevelopment && { stack: err.stack })
  });
});

// 404 处理
app.use('*', (req, res) => {
  logger.warn('404 Not Found', {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`
  });
});

// 优雅关闭处理
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  // 停止性能监控
  performanceMonitor.stop();
  
  // 关闭服务器
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown', err);
      process.exit(1);
    }
    
    logger.info('Server closed successfully');
    process.exit(0);
  });
  
  // 强制退出超时
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
}

// 启动服务器
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`, {
    port: PORT,
    nodeEnv: NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform
  });
  
  console.log(`🗳️  FHEVM Voting System server running at http://localhost:${PORT}`);
  console.log(`📱 Available pages:`);
  console.log(`   - Voting System: http://localhost:${PORT}/`);
  console.log(`🔧 API endpoints:`);
  console.log(`   - Health check: http://localhost:${PORT}/api/health`);
  console.log(`   - Configuration: http://localhost:${PORT}/config.json`);
  console.log(`   - Deployment info: http://localhost:${PORT}/api/deployments`);
  
  // 启动性能监控
  if (performanceMonitor.options.enabled) {
    logger.info('Performance monitoring enabled');
  }
});

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString()
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// 处理进程信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 导出服务器实例（用于测试）
module.exports = { app, server, performanceMonitor, logger };