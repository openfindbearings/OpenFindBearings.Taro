# deploy（OpenFindBearings.Taro 部署模板）

本目录是 Taro 前端（H5 静态站 + APK 下载服务）的 K8s 清单模板。部署时请将占位符替换为真实域名。

## 步骤

1. **替换占位符**：
   - `<your-mobile-domain>`：H5 站点域名（deploy.yml Ingress，TLS 由 cert-manager 签发）
   - `<your-bff-domain>`：BFF 域名（apk-server.yml 的 /dl 下载路径 Ingress，与 BFF 共用域名）
2. **Secret**：apk-server 的 apk-sync CronJob 复用 `openfindbearings-api-secrets`（数据库连接串，见 API 仓库 deploy/secrets 模板）
3. 镜像 `ghcr.io/openfindbearings/openfindbearings-taro`（公开；自用版"轴承帮"需配置 pro PAT 构建，见仓库 README）

## apply

```
deploy.yml → apk-server.yml
```

> 完整运维清单（真实域名/密钥）在私有运维库，本目录只提供模板，占位符请在部署时替换为真实值。
