/**
 * 安全头配置模块
 * 提供各种安全相关的HTTP头设置
 */

const helmet = require('helmet');

/**
 * 获取安全头配置
 * @param {string} env - 环境变量 (development, production, test)
 * @returns {Object} Helmet 配置对象
 */
function getSecurityHeaders(env = 'production') {
  const isDevelopment = env === 'development';
  const isProduction = env === 'production';

  return {
    // 内容安全策略
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // 开发环境需要，生产环境应该移除
          "'unsafe-eval'", // FHEVM 可能需要
          'https://cdn.jsdelivr.net',
          'https://unpkg.com',
          'https://cdnjs.cloudflare.com',
          ...(isDevelopment ? ["'unsafe-inline'", "'unsafe-eval'"] : [])
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://cdn.jsdelivr.net'
        ],
        fontSrc: [
          "'self'",
          'https://fonts.gstatic.com',
          'https://cdn.jsdelivr.net'
        ],
        imgSrc: [
          "'self'",
          'data:',
          'https:',
          'blob:'
        ],
        connectSrc: [
          "'self'",
          'https://gateway.devnet.zama.ai',
          'https://devnet.zama.ai',
          'https://sepolia.infura.io',
          'https://mainnet.infura.io',
          'https://api.etherscan.io',
          'https://api-sepolia.etherscan.io',
          'wss://sepolia.infura.io',
          'wss://mainnet.infura.io',
          ...(isDevelopment ? ['http://localhost:*', 'ws://localhost:*'] : [])
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'],
        childSrc: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null
      },
      reportOnly: isDevelopment
    },

    // 跨域嵌入保护
    crossOriginEmbedderPolicy: {
      policy: isDevelopment ? 'unsafe-none' : 'require-corp'
    },

    // 跨域打开保护
    crossOriginOpenerPolicy: {
      policy: 'same-origin'
    },

    // 跨域资源保护
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    },

    // DNS 预取控制
    dnsPrefetchControl: {
      allow: false
    },

    // 下载选项
    ieNoOpen: true,

    // 框架选项
    frameguard: {
      action: 'deny'
    },

    // 隐藏 X-Powered-By
    hidePoweredBy: true,

    // HSTS (仅生产环境)
    hsts: isProduction ? {
      maxAge: 31536000, // 1 年
      includeSubDomains: true,
      preload: true
    } : false,

    // 禁用客户端缓存
    noSniff: true,

    // 来源策略
    originAgentCluster: true,

    // 权限策略
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none'
    },

    // 引用策略
    referrerPolicy: {
      policy: ['no-referrer', 'strict-origin-when-cross-origin']
    },

    // XSS 过滤
    xssFilter: true
  };
}

/**
 * 获取 CORS 配置
 * @param {string} env - 环境变量
 * @returns {Object} CORS 配置对象
 */
function getCorsConfig(env = 'production') {
  const isDevelopment = env === 'development';

  return {
    origin: function (origin, callback) {
      // 允许的源列表
      const allowedOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://your-domain.com', // 替换为实际域名
        ...(isDevelopment ? [
          'http://localhost:3001',
          'http://localhost:8080',
          'http://127.0.0.1:8080'
        ] : [])
      ];

      // 开发环境允许无 origin 的请求（如 Postman）
      if (isDevelopment && !origin) {
        return callback(null, true);
      }

      if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'X-CSRF-Token'
    ],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400 // 24 小时
  };
}

/**
 * 速率限制配置
 * @param {string} env - 环境变量
 * @returns {Object} 速率限制配置
 */
function getRateLimitConfig(env = 'production') {
  const isDevelopment = env === 'development';

  return {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 分钟
    max: parseInt(process.env.RATE_LIMIT_MAX) || (isDevelopment ? 1000 : 100), // 限制请求数
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // 跳过健康检查和静态资源
      return req.path === '/api/health' || 
             req.path.startsWith('/static/') ||
             req.path.startsWith('/css/') ||
             req.path.startsWith('/js/') ||
             req.path.startsWith('/images/');
    },
    keyGenerator: (req) => {
      // 使用 IP 地址作为限制键
      return req.ip || req.connection.remoteAddress;
    }
  };
}

/**
 * 输入验证中间件
 */
function inputValidation() {
  return (req, res, next) => {
    // 检查请求体大小
    const maxSize = parseInt(process.env.MAX_REQUEST_SIZE) || 1024 * 1024; // 1MB
    if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
      return res.status(413).json({ error: 'Request entity too large' });
    }

    // 基本的 XSS 防护
    const xssPattern = /<script[^>]*>.*?<\/script>/gi;
    const checkXSS = (obj) => {
      if (typeof obj === 'string') {
        return xssPattern.test(obj);
      }
      if (typeof obj === 'object' && obj !== null) {
        return Object.values(obj).some(checkXSS);
      }
      return false;
    };

    if (req.body && checkXSS(req.body)) {
      return res.status(400).json({ error: 'Invalid input detected' });
    }

    next();
  };
}

/**
 * 安全日志中间件
 */
function securityLogger() {
  return (req, res, next) => {
    // 记录可疑活动
    const suspiciousPatterns = [
      /\.\.\//, // 路径遍历
      /<script/i, // XSS 尝试
      /union.*select/i, // SQL 注入
      /javascript:/i, // JavaScript 协议
      /vbscript:/i, // VBScript 协议
      /on\w+\s*=/i // 事件处理器
    ];

    const url = req.url;
    const userAgent = req.get('User-Agent') || '';
    const referer = req.get('Referer') || '';

    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(url) || pattern.test(userAgent) || pattern.test(referer)
    );

    if (isSuspicious) {
      console.warn('Suspicious request detected:', {
        ip: req.ip,
        url: req.url,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

module.exports = {
  getSecurityHeaders,
  getCorsConfig,
  getRateLimitConfig,
  inputValidation,
  securityLogger
};