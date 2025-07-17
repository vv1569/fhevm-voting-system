# 使用官方 Node.js 18 LTS 镜像作为基础镜像
FROM node:18-alpine AS base

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 开发阶段
FROM base AS development

# 安装开发依赖
RUN npm ci

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3000 8545

# 开发模式启动命令
CMD ["npm", "run", "dev"]

# 构建阶段
FROM base AS build

# 安装所有依赖（包括开发依赖）
RUN npm ci

# 复制源代码
COPY . .

# 编译合约
RUN npm run compile

# 构建前端资源（如果有构建步骤）
RUN npm run build || echo "No build script found"

# 生产阶段
FROM base AS production

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 复制构建产物
COPY --from=build --chown=nextjs:nodejs /app/artifacts ./artifacts
COPY --from=build --chown=nextjs:nodejs /app/cache ./cache
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/contracts ./contracts
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=build --chown=nextjs:nodejs /app/server.js ./server.js
COPY --from=build --chown=nextjs:nodejs /app/hardhat.config.js ./hardhat.config.js
COPY --from=build --chown=nextjs:nodejs /app/package*.json ./

# 创建日志目录
RUN mkdir -p logs && chown nextjs:nodejs logs

# 切换到非 root 用户
USER nextjs

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]

# 测试阶段
FROM development AS test

# 运行测试
RUN npm run test

# 运行代码质量检查
RUN npm run lint
RUN npm run format:check

# 安全审计
RUN npm audit --audit-level moderate