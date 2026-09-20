# 改动说明：builder 阶段由 node:20-alpine(musl) 改为 node:20-slim(Debian glibc)。
# @tarojs/binding@3.6.40 未发布 linux-x64-musl 变体，Alpine 下 build:h5 会因缺
# musl 原生绑定失败；glibc 用 lockfile 已有的 linux-x64-gnu 绑定即可。
# 运行时镜像保持 nginx:alpine（仅托管静态文件，不执行 node，无 musl 问题）。
FROM node:20-slim AS builder
WORKDIR /app
# 改动说明（v1.7.3）：9.15.0 → 10.15.0——pnpm 9 只读 package.json 的 patchedDependencies、
#   11+ 只读 pnpm-workspace.yaml，唯 v10 双读兼容；镜像构建需应用 react-native-image-picker patch
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
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
