/**
 * 性能监控模块
 * 提供应用性能指标收集和监控功能
 */

const EventEmitter = require('events');
const os = require('os');
const process = require('process');

class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      collectInterval: options.collectInterval || 30000, // 30秒
      memoryThreshold: options.memoryThreshold || 0.8, // 80%
      cpuThreshold: options.cpuThreshold || 0.8, // 80%
      responseTimeThreshold: options.responseTimeThreshold || 1000, // 1秒
      enabled: options.enabled !== false,
      ...options
    };
    
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        error: 0,
        responseTimes: []
      },
      system: {
        memory: {
          used: 0,
          total: 0,
          percentage: 0
        },
        cpu: {
          usage: 0
        },
        uptime: 0
      },
      blockchain: {
        transactions: {
          total: 0,
          success: 0,
          failed: 0,
          pending: 0
        },
        gasUsage: {
          total: 0,
          average: 0
        },
        blockHeight: 0
      },
      errors: []
    };
    
    this.startTime = Date.now();
    this.lastCpuUsage = process.cpuUsage();
    
    if (this.options.enabled) {
      this.start();
    }
  }

  /**
   * 启动性能监控
   */
  start() {
    this.collectInterval = setInterval(() => {
      this.collectMetrics();
    }, this.options.collectInterval);
    
    console.log('Performance monitoring started');
  }

  /**
   * 停止性能监控
   */
  stop() {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
      this.collectInterval = null;
    }
    console.log('Performance monitoring stopped');
  }

  /**
   * 收集系统指标
   */
  collectMetrics() {
    this.collectSystemMetrics();
    this.checkThresholds();
    this.emit('metrics', this.getMetrics());
  }

  /**
   * 收集系统指标
   */
  collectSystemMetrics() {
    // 内存使用情况
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    this.metrics.system.memory = {
      used: usedMem,
      total: totalMem,
      percentage: usedMem / totalMem,
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: memUsage.heapUsed / memUsage.heapTotal
      },
      external: memUsage.external,
      rss: memUsage.rss
    };

    // CPU 使用情况
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    const cpuPercent = (currentCpuUsage.user + currentCpuUsage.system) / 1000000 / (this.options.collectInterval / 1000);
    this.metrics.system.cpu.usage = Math.min(cpuPercent, 1);
    this.lastCpuUsage = process.cpuUsage();

    // 运行时间
    this.metrics.system.uptime = Date.now() - this.startTime;
  }

  /**
   * 检查阈值并发出警告
   */
  checkThresholds() {
    const { memory, cpu } = this.metrics.system;
    
    if (memory.percentage > this.options.memoryThreshold) {
      this.emit('warning', {
        type: 'memory',
        message: `Memory usage is ${(memory.percentage * 100).toFixed(2)}%`,
        value: memory.percentage,
        threshold: this.options.memoryThreshold
      });
    }
    
    if (cpu.usage > this.options.cpuThreshold) {
      this.emit('warning', {
        type: 'cpu',
        message: `CPU usage is ${(cpu.usage * 100).toFixed(2)}%`,
        value: cpu.usage,
        threshold: this.options.cpuThreshold
      });
    }
  }

  /**
   * 记录请求指标
   */
  recordRequest(req, res, responseTime) {
    this.metrics.requests.total++;
    
    if (res.statusCode >= 200 && res.statusCode < 400) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.error++;
    }
    
    this.metrics.requests.responseTimes.push(responseTime);
    
    // 保持响应时间数组大小
    if (this.metrics.requests.responseTimes.length > 1000) {
      this.metrics.requests.responseTimes = this.metrics.requests.responseTimes.slice(-500);
    }
    
    if (responseTime > this.options.responseTimeThreshold) {
      this.emit('warning', {
        type: 'response_time',
        message: `Slow response: ${responseTime}ms for ${req.method} ${req.path}`,
        value: responseTime,
        threshold: this.options.responseTimeThreshold,
        request: {
          method: req.method,
          path: req.path,
          ip: req.ip
        }
      });
    }
  }

  /**
   * 记录区块链交易指标
   */
  recordTransaction(tx, status, gasUsed) {
    this.metrics.blockchain.transactions.total++;
    
    switch (status) {
      case 'success':
        this.metrics.blockchain.transactions.success++;
        break;
      case 'failed':
        this.metrics.blockchain.transactions.failed++;
        break;
      case 'pending':
        this.metrics.blockchain.transactions.pending++;
        break;
    }
    
    if (gasUsed) {
      this.metrics.blockchain.gasUsage.total += gasUsed;
      this.metrics.blockchain.gasUsage.average = 
        this.metrics.blockchain.gasUsage.total / this.metrics.blockchain.transactions.total;
    }
  }

  /**
   * 记录错误
   */
  recordError(error, context = {}) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context,
      type: error.constructor.name
    };
    
    this.metrics.errors.push(errorRecord);
    
    // 保持错误数组大小
    if (this.metrics.errors.length > 100) {
      this.metrics.errors = this.metrics.errors.slice(-50);
    }
    
    this.emit('error', errorRecord);
  }

  /**
   * 获取当前指标
   */
  getMetrics() {
    const responseTimes = this.metrics.requests.responseTimes;
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    return {
      timestamp: new Date().toISOString(),
      uptime: this.metrics.system.uptime,
      requests: {
        ...this.metrics.requests,
        averageResponseTime: avgResponseTime,
        requestsPerSecond: this.metrics.requests.total / (this.metrics.system.uptime / 1000)
      },
      system: this.metrics.system,
      blockchain: this.metrics.blockchain,
      errors: {
        total: this.metrics.errors.length,
        recent: this.metrics.errors.slice(-10)
      }
    };
  }

  /**
   * 获取健康状态
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    const issues = [];
    
    if (metrics.system.memory.percentage > this.options.memoryThreshold) {
      issues.push(`High memory usage: ${(metrics.system.memory.percentage * 100).toFixed(2)}%`);
    }
    
    if (metrics.system.cpu.usage > this.options.cpuThreshold) {
      issues.push(`High CPU usage: ${(metrics.system.cpu.usage * 100).toFixed(2)}%`);
    }
    
    if (metrics.requests.averageResponseTime > this.options.responseTimeThreshold) {
      issues.push(`Slow response time: ${metrics.requests.averageResponseTime.toFixed(2)}ms`);
    }
    
    const errorRate = metrics.requests.total > 0 
      ? metrics.requests.error / metrics.requests.total 
      : 0;
    
    if (errorRate > 0.1) { // 10% 错误率
      issues.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
    }
    
    return {
      status: issues.length === 0 ? 'healthy' : 'warning',
      issues,
      metrics: {
        uptime: metrics.uptime,
        memoryUsage: `${(metrics.system.memory.percentage * 100).toFixed(2)}%`,
        cpuUsage: `${(metrics.system.cpu.usage * 100).toFixed(2)}%`,
        averageResponseTime: `${metrics.requests.averageResponseTime.toFixed(2)}ms`,
        totalRequests: metrics.requests.total,
        errorRate: `${(errorRate * 100).toFixed(2)}%`
      }
    };
  }

  /**
   * 重置指标
   */
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        error: 0,
        responseTimes: []
      },
      system: {
        memory: { used: 0, total: 0, percentage: 0 },
        cpu: { usage: 0 },
        uptime: 0
      },
      blockchain: {
        transactions: { total: 0, success: 0, failed: 0, pending: 0 },
        gasUsage: { total: 0, average: 0 },
        blockHeight: 0
      },
      errors: []
    };
    this.startTime = Date.now();
  }
}

/**
 * Express 中间件工厂
 */
function createPerformanceMiddleware(monitor) {
  return (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      monitor.recordRequest(req, res, responseTime);
    });
    
    next();
  };
}

/**
 * 创建性能监控实例
 */
function createMonitor(options = {}) {
  return new PerformanceMonitor(options);
}

module.exports = {
  PerformanceMonitor,
  createPerformanceMiddleware,
  createMonitor
};