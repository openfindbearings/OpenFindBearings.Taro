# Stage 1: 构建 Taro H5
FROM node:22-alpine AS build
WORKDIR /app

# pnpm v11 默认禁用构建脚本，需显式允许
ENV PNPM_ALLOW_ALL_BUILDS=1

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build:h5

# Stage 2: nginx 托管静态文件
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
