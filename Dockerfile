# Stage 1: 构建 Taro H5
FROM node:22-alpine AS build
WORKDIR /app

# 使用 pnpm v9（支持 package.json 的 pnpm.onlyBuiltDependencies 字段）
RUN npm install -g pnpm@9.15.0

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build:h5

# Stage 2: nginx 托管静态文件
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
