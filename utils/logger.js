/**
 * 统一日志管理模块
 * 提供结构化日志记录功能
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

class Logger {
  constructor(options = {}) {
    this.options = {
      level: options.level || process.env.LOG_LEVEL || 'info',
      file: options.file || process.env.LOG_FILE || null,
      console: options.console !== false,
      format: options.format || 'json', // 'json' | 'text'
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: options.maxFiles || 5,
      timestamp: options.timestamp !== false,
      colorize: options.colorize !== false && process.stdout.isTTY,
      ...options
    };

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      verbose: 4,
      debug: 5,
      silly: 6
    };

    this.colors = {
      error: '\x1b[31m',   // 红色
      warn: '\x1b[33m',    // 黄色
      info: '\x1b[36m',    // 青色
      http: '\x1b[35m',    // 紫色
      verbose: '\x1b[37m', // 白色
      debug: '\x1b[32m',   // 绿色
      silly: '\x1b[90m',   // 灰色
      reset: '\x1b[0m'
    };

    this.currentLogLevel = this.levels[this.options.level] || this.levels.info;
    
    // 确保日志目录存在
    if (this.options.file) {
      const logDir = path.dirname(this.options.file);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  /**
   * 检查日志级别是否应该输出
   */
  shouldLog(level) {
    return this.levels[level] <= this.currentLogLevel;
  }

  /**
   * 格式化日志消息
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };

    if (this.options.format === 'json') {
      return JSON.stringify(logEntry);
    } else {
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
    }
  }

  /**
   * 格式化控制台输出
   */
  formatConsoleMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const color = this.options.colorize ? this.colors[level] : '';
    const reset = this.options.colorize ? this.colors.reset : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${util.inspect(meta, { colors: this.options.colorize, depth: 2 })}` : '';
    
    return `${color}${timestamp} [${level.toUpperCase()}] ${message}${reset}${metaStr}`;
  }

  /**
   * 写入日志文件
   */
  writeToFile(formattedMessage) {
    if (!this.options.file) return;

    try {
      // 检查文件大小并轮转
      if (fs.existsSync(this.options.file)) {
        const stats = fs.statSync(this.options.file);
        if (stats.size >= this.options.maxFileSize) {
          this.rotateLogFile();
        }
      }

      fs.appendFileSync(this.options.file, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * 轮转日志文件
   */
  rotateLogFile() {
    try {
      const logDir = path.dirname(this.options.file);
      const logName = path.basename(this.options.file, path.extname(this.options.file));
      const logExt = path.extname(this.options.file);

      // 删除最老的日志文件
      const oldestLog = path.join(logDir, `${logName}.${this.options.maxFiles - 1}${logExt}`);
      if (fs.existsSync(oldestLog)) {
        fs.unlinkSync(oldestLog);
      }

      // 重命名现有日志文件
      for (let i = this.options.maxFiles - 2; i >= 0; i--) {
        const currentLog = i === 0 
          ? this.options.file 
          : path.join(logDir, `${logName}.${i}${logExt}`);
        const nextLog = path.join(logDir, `${logName}.${i + 1}${logExt}`);
        
        if (fs.existsSync(currentLog)) {
          fs.renameSync(currentLog, nextLog);
        }
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error.message);
    }
  }

  /**
   * 核心日志方法
   */
  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, meta);
    const consoleMessage = this.formatConsoleMessage(level, message, meta);

    // 输出到控制台
    if (this.options.console) {
      if (level === 'error') {
        console.error(consoleMessage);
      } else if (level === 'warn') {
        console.warn(consoleMessage);
      } else {
        console.log(consoleMessage);
      }
    }

    // 写入文件
    this.writeToFile(formattedMessage);
  }

  /**
   * 错误日志
   */
  error(message, meta = {}) {
    if (message instanceof Error) {
      meta = {
        stack: message.stack,
        name: message.name,
        ...meta
      };
      message = message.message;
    }
    this.log('error', message, meta);
  }

  /**
   * 警告日志
   */
  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  /**
   * 信息日志
   */
  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  /**
   * HTTP 请求日志
   */
  http(message, meta = {}) {
    this.log('http', message, meta);
  }

  /**
   * 详细日志
   */
  verbose(message, meta = {}) {
    this.log('verbose', message, meta);
  }

  /**
   * 调试日志
   */
  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  /**
   * 最详细日志
   */
  silly(message, meta = {}) {
    this.log('silly', message, meta);
  }

  /**
   * 记录请求日志
   */
  logRequest(req, res, responseTime) {
    const meta = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length') || 0
    };

    const message = `${req.method} ${req.url} ${res.statusCode} ${responseTime}ms`;
    this.http(message, meta);
  }

  /**
   * 记录区块链交易日志
   */
  logTransaction(txHash, status, gasUsed, meta = {}) {
    const logMeta = {
      txHash,
      status,
      gasUsed,
      ...meta
    };

    const message = `Transaction ${txHash} ${status}`;
    if (status === 'success') {
      this.info(message, logMeta);
    } else if (status === 'failed') {
      this.error(message, logMeta);
    } else {
      this.debug(message, logMeta);
    }
  }

  /**
   * 记录安全事件
   */
  logSecurity(event, severity = 'warn', meta = {}) {
    const securityMeta = {
      securityEvent: true,
      event,
      severity,
      timestamp: new Date().toISOString(),
      ...meta
    };

    const message = `Security event: ${event}`;
    if (severity === 'critical') {
      this.error(message, securityMeta);
    } else if (severity === 'high') {
      this.warn(message, securityMeta);
    } else {
      this.info(message, securityMeta);
    }
  }

  /**
   * 记录性能指标
   */
  logPerformance(metric, value, meta = {}) {
    const perfMeta = {
      performanceMetric: true,
      metric,
      value,
      unit: meta.unit || 'ms',
      ...meta
    };

    this.info(`Performance: ${metric} = ${value}${meta.unit || 'ms'}`, perfMeta);
  }

  /**
   * 创建子日志器
   */
  child(defaultMeta = {}) {
    const childLogger = Object.create(this);
    childLogger.defaultMeta = { ...this.defaultMeta, ...defaultMeta };
    
    // 重写 log 方法以包含默认元数据
    const originalLog = this.log.bind(this);
    childLogger.log = (level, message, meta = {}) => {
      return originalLog(level, message, { ...childLogger.defaultMeta, ...meta });
    };
    
    return childLogger;
  }
}

/**
 * Express 中间件工厂
 */
function createLoggerMiddleware(logger) {
  return (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      logger.logRequest(req, res, responseTime);
    });
    
    next();
  };
}

/**
 * 创建默认日志器实例
 */
const defaultLogger = new Logger();

module.exports = {
  Logger,
  createLoggerMiddleware,
  logger: defaultLogger
};