# OpenFindBearings.Taro

移动端 H5 前端，基于 Taro 4.x + React 18 + TypeScript 构建，一套代码编译到 H5（浏览器）、微信小程序、Android/iOS 原生 APP（React Native）。

## 技术栈

- Taro 4.x + React 18 + TypeScript
- NutUI (React 版) UI 组件库
- lucide-react-taro 图标库（1500+ 图标，tree-shaking）
- Zustand 状态管理
- Sass 样式预处理器

## 架构

Taro H5 前端独立部署到 `mobile.515813.xyz`，通过 BFF (bff.515813.xyz) 访问后端服务。

```
Taro H5 (mobile.515813.xyz) → Mobile BFF (bff.515813.xyz) → API + Identity
```

## 功能特性

| Tab | 功能 | 说明 |
|-----|------|------|
| 首页 | 轴承/商家搜索 | 核心查询功能，无需登录 |
| 入驻/商家 | 商家入驻申请/管理 | 商家行为（需入驻后） |
| 我的 | 个人中心 | 收藏/关注/历史（需登录） |

## 构建与运行

```bash
# 安装依赖
pnpm install

# 开发模式（H5）
pnpm run dev:h5

# 构建 H5
pnpm run build:h5
```

开发时 H5 服务运行在 `http://localhost:10087`，API 请求通过 webpack 代理转发到 BFF。

## 部署

### K3s 部署

```bash
kubectl apply -f deploy/k3s/
```

- 域名：`mobile.515813.xyz`
- 镜像：`ghcr.io/openfindbearings/openfindbearings-taro`

### CI/CD

GitHub Actions 自动构建推送：

- `build.yml`：push/PR 到 main、dev 时构建验证
- `deploy.yml`：Release 发布或手动 workflow_dispatch 时构建镜像推送到 GHCR，并更新 K3s Deployment

镜像地址：`ghcr.io/openfindbearings/openfindbearings-taro`

## 目录结构

```
src/
├── app.ts                      # 应用入口
├── app.config.ts              # 全局配置（TabBar、路由等）
├── app.scss                   # 全局样式
├── services/                  # API 服务层
│   ├── request.ts             # HTTP 请求封装
│   ├── auth.ts                # 认证服务
│   ├── bearing.ts             # 轴承服务
│   ├── merchant.ts            # 商家服务
│   ├── user.ts                # 用户服务
│   └── merchantManage.ts      # 商家管理服务
├── stores/                    # 状态管理
│   ├── authStore.ts           # 认证状态
│   ├── searchStore.ts         # 搜索状态
│   └── favoriteStore.ts       # 收藏状态
├── utils/                     # 工具函数
│   ├── token.ts               # Token 存储
│   ├── format.ts              # 格式化工具
│   └── storage.ts             # 本地存储
├── components/                # 公共组件
│   ├── AuthGuard.tsx          # 登录守卫
│   ├── EmptyState.tsx         # 空状态组件
│   ├── LoadingState.tsx       # 加载状态组件
│   ├── PriceTag.tsx           # 价格标签
│   └── MerchantBadge.tsx      # 商家标识
└── pages/                     # 页面
    ├── home/                  # 首页
    ├── merchant/              # 入驻/商家页
    └── profile/               # 我的页
```

## 相关文档

### 设计文档

- [Taro 移动端设计](./doc/OpenFindBearings.Taro移动端设计-v1.1.0.md)

### 接口与规范

- [API 对接说明](./doc/01-API对接说明/API对接说明-v1.0.0.md) — 前端调用 BFF 的完整接口清单、请求/响应结构
- [UI 组件规范](./doc/02-UI组件规范/UI组件规范-v1.0.0.md) — 图标使用、组件选型、样式变量
- [跨端适配说明](./doc/03-跨端适配说明/跨端适配说明-v1.0.0.md) — H5/小程序/RN 差异、条件编译

### 关联项目

- [Mobile BFF 设计](../OpenFindBearings.Mobile/doc/OpenFindBearings.Mobile-BFF设计-v1.0.0.md)
