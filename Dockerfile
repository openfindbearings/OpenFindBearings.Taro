# 改动说明：builder 阶段由 node:20-alpine(musl) 改为 node:20-slim(Debian glibc)。
# @tarojs/binding@3.6.40 未发布 linux-x64-musl 变体，Alpine 下 build:h5 会因缺
# musl 原生绑定失败；glibc 用 lockfile 已有的 linux-x64-gnu 绑定即可。
# 运行时镜像保持 nginx:alpine（仅托管静态文件，不执行 node，无 musl 问题）。
FROM node:20-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build:h5

FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
