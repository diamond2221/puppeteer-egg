# 使用官方的 Node.js 镜像，建议使用 Node.js 18 及以上的 LTS 版本
FROM docker.m.daocloud.io/library/node:18-slim

# 设置工作目录
WORKDIR /app

RUN sed -i 's/deb.debian.org/mirrors.ustc.edu.cn/g' /etc/apt/sources.list.d/debian.sources

# 复制 package.json 和 package-lock.json（如果存在）
COPY package*.json ./

RUN npm config set registry https://registry.npmmirror.com && npm install -g pnpm

# 安装依赖
RUN pnpm install


# 复制项目的所有文件到工作目录
COPY . .

# 替换 debian 的 launch 配置
RUN sed -i "s|\/\/ headless: false,|executablePath: '/usr/bin/google-chrome-stable', args: [ '--no-sandbox', '--disable-setuid-sandbox' ],|g" app/module/bar/controller/home.ts

# 构建项目（如果有构建步骤，比如使用 TypeScript）
# 如果没有构建步骤，可将此行注释或删除
# RUN npm run build

# 暴露应用的端口，默认 Egg.js 的端口为 7001
EXPOSE 7001

# 使用环境变量指定 Egg.js 启动环境，默认为 "prod"
# ENV EGG_SERVER_ENV=prod

# 启动服务
CMD ["pnpm", "run", "dev"]
