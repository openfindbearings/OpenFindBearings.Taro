# Stage 1: 构建 Taro H5
FROM node:22-alpine AS build
WORKDIR /app

# 安装 Taro binding 平台特定包
RUN npm install -g @tarojs/binding-linux-x64-musl

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --dangerously-allow-all-builds

# 确保 Taro binding 正确链接
RUN pnpm add @tarojs/binding-linux-x64-musl

COPY . .
RUN pnpm run build:h5

# Stage 2: nginx 托管静态文件
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]