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
# 改动说明（pro 扩展缝）：自用构建（build-arg TARO_BUILD_PRO=1，由 workflow 注入 pro 源码）把
# pro-src 装配为 node_modules/@ofb/taro-pro、注入"轴承帮"名字/官方图标后构建；开源构建（未设参数）
# 走占位 alias 构建，公开 fork 行为一致。pro-src 由 deploy.yml 从私有库 FindBearings.Taro.Pro 拉取
ARG TARO_BUILD_PRO
RUN if [ "$TARO_BUILD_PRO" = "1" ]; then \
      mkdir -p node_modules/@ofb && cp -r pro-src node_modules/@ofb/taro-pro && \
      TARO_BUILD_PRO=1 node scripts/apply-pro.js && TARO_BUILD_PRO=1 pnpm run build:h5; \
    else \
      pnpm run build:h5; \
    fi

FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
