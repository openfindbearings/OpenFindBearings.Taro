# 改动说明：builder 阶段由 node:20-alpine(musl) 改为 node:20-slim(Debian glibc)。
# @tarojs/binding@3.6.40 未发布 linux-x64-musl 变体，Alpine 下 build:h5 会因缺
# musl 原生绑定失败；glibc 用 lockfile 已有的 linux-x64-gnu 绑定即可。
# 运行时镜像保持 nginx:alpine（仅托管静态文件，不执行 node，无 musl 问题）。
FROM node:20-slim AS builder
WORKDIR /app
# 改动说明（v1.7.3）：统一 pnpm@12.4.2 与本地一致——patchedDependencies 配置在 pnpm-workspace.yaml（v11+ 读取），
#   lock 内 patch hash 跨大版本算法不同，CI/本地/Docker 三处版本必须一致否则 frozen 校验失败
RUN corepack enable && corepack prepare pnpm@12.4.2 --activate
# 改动说明（v1.7.3 修复）：COPY 补上 pnpm-workspace.yaml 与 patches/——overrides/patchedDependencies
#   配置源在 workspace.yaml（v11+ 不再读 package.json 的 pnpm 节），缺文件则容器内配置为空，
#   与 lock 中记录的值 mismatch，frozen 校验直接失败；patch 文件本体也是 install 应用补丁的依赖
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build:h5

FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
