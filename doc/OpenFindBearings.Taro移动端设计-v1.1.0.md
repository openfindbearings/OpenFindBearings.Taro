# OpenFindBearings.Taro 移动端设计 v1.1.0

## 概述

OpenFindBearings.Taro 是统一的移动端前端，基于 Taro 4.x + React 18 + TypeScript 构建，一套代码编译到 H5（浏览器）、微信小程序、Android/iOS 原生 APP（React Native），替代原 MAUI + 微信小程序分开做的方案。

Taro 负责前端界面，通过 Mobile BFF（OpenFindBearings.Mobile）访问后端 API 与 Identity 认证服务。Taro 与 BFF 独立部署、独立扩缩容。

## 变更日志

### v1.1.0 (2026-08-31)

- Taro 从 BFF 镜像中分离，独立部署到 nginx 容器。
- 新增 Dockerfile（Node.js 构建 → nginx 托管静态文件）与 nginx.conf（SPA 路由 + gzip + 缓存）。
- 新增 K3s 部署文件（Deployment + Service + Ingress，域名 mobile.515813.xyz）。
- API 对接改为走 BFF 域名 bff.515813.xyz/mobile/*。
- 认证流程更新为经 BFF 代理 Identity。

### v1.0.0 (2026-08-31)

- 初始版本，完成整体架构设计与技术选型。

## 专项文档

本设计文档为 Taro 总体架构文档，各专项内容已拆分为独立文档：

| 文档 | 说明 |
|------|------|
| [API 对接说明](./01-API对接说明/API对接说明-v1.0.0.md) | 前端调用 BFF 的完整接口清单、请求/响应结构 |
| [UI 组件规范](./02-UI组件规范/UI组件规范-v1.0.0.md) | 图标使用、组件选型、样式变量 |
| [跨端适配说明](./03-跨端适配说明/跨端适配说明-v1.0.0.md) | H5/小程序/RN 差异、条件编译 |

## 技术栈

| 层面 | 选型 | 理由 |
|---|---|---|
| 框架 | Taro 4.x + React 18 + TypeScript | Taro 生态成熟，多端编译 |
| UI 组件 | NutUI (React 版) | 京东出品，与 Taro 深度集成，移动端组件丰富 |
| 状态管理 | Zustand | 轻量、支持持久化、无 Provider 包裹 |
| HTTP | Taro.request 封装 | 统一拦截器、JWT 自动附加、错误处理 |
| Token 存储 | 跨端适配层 | 小程序用 `Taro.setStorageSync`，H5 用 `localStorage` |
| 样式 | SCSS + 命名空间隔离 | 与现有项目风格统一 |

## 目标平台

| 平台 | 编译目标 | 说明 |
|---|---|---|
| H5 | `taro build --type h5` | 浏览器直接访问，调试/分享用 |
| 微信小程序 | `taro build --type weapp` | 用户主要入口 |
| Android | React Native | 打包原生 APK |
| iOS | React Native | 打包原生 IPA |

## 三 Tab 架构

```
┌──────────────────────────────────────────────────────┐
│  Tab 1: 首页          Tab 2: 入驻/商家     Tab 3: 我的     │
│  ─────────          ──────────         ────────    │
│  核心查询              商家行为            个人行为      │
│  · 搜索框              · 入驻申请           · 收藏轴承     │
│  · 热门轴承            · 店铺信息维护        · 关注商家     │
│  · 推荐商家            · 在售商品管理        · 浏览记录     │
│  · 轴承/商家结果        · 员工管理           · 个人信息     │
│  · 轴承详情            · 议价/询价(预留)     · 积分(预留)    │
│  · 商家详情            · 入驻状态展示        · 设置        │
└──────────────────────────────────────────────────────┘
```

### Tab 1: 首页（核心查询）

本 Tab 承载软件核心查询功能，所有内容无需登录即可使用。

| 模块 | 说明 | 登录 |
|---|---|---|
| 顶部搜索栏 | 关键词搜索轴承型号/品牌/商家名 | 无 |
| 热门轴承 | 按浏览量/收藏量排序的热门型号 | 无 |
| 推荐商家 | 已认证商家列表 | 无 |
| 搜索结果 | 轴承列表（型号/品牌/类型/尺寸） | 无 |
| 轴承详情 | 完整参数 + 在售商家 + 替代品 | 无 |
| 商家详情 | 商家信息 + 在售商品 | 无 |

首页 API 全部公开，无需登录即可使用。

### Tab 2: 入驻/商家（商家行为）

本 Tab 根据用户入驻状态切换视图。

| 状态 | 界面 | 功能 |
|---|---|---|
| 未入驻 | 入驻引导页 | 申请入驻（填写联系人信息、上传执照） |
| 审核中 | 状态等待页 | 显示审核进度 |
| 已入驻 | 商家管理面板 | 店铺信息、在售商品、员工管理、议价(预留) |

入驻后 Tab 图标从通用图标切换为商家自己的图标。

议价/询价等商家交互功能预留在此 Tab。

### Tab 3: 我的（个人行为）

本 Tab 管理登录后的个人内容。

| 模块 | 说明 | 登录 |
|---|---|---|
| 头像/昵称 | 点击登录/注册 | 无 |
| 我的收藏 | 已收藏的轴承列表 | 需登录 |
| 关注商家 | 已关注的商家列表 | 需登录 |
| 浏览记录 | 最近查看的轴承/商家 | 需登录 |
| 入口 | 如果已是商家，显示"我的店铺"快捷入口 | 需登录+已入驻 |
| 设置 | 关于、版本、清除缓存 | 无 |

## 目录结构

```
src/
├── app.ts                           # 入口，全局 Provider
├── app.config.ts                    # TabBar + 路由配置
├── app.scss                         # 全局样式变量
│
├── services/                        # API 层
│   ├── request.ts                   # HTTP 封装（拦截器、Token、重试）
│   ├── auth.ts                      # 认证（登录/注册/刷新/登出）
│   ├── bearing.ts                   # 轴承查询（搜索/详情/热门/推荐）
│   ├── merchant.ts                  # 商家查询（搜索/详情/在售商品）
│   ├── user.ts                      # 用户（收藏/关注/浏览记录）
│   └── merchantManage.ts            # 商家管理（入驻申请/信息维护/商品管理）
│
├── stores/                          # 状态管理
│   ├── authStore.ts                 # 认证状态 + Token 管理
│   ├── searchStore.ts               # 搜索/筛选状态
│   └── favoriteStore.ts             # 收藏/关注状态
│
├── utils/                           # 工具
│   ├── token.ts                     # Token 存储跨端适配
│   ├── format.ts                    # 价格/时间/数字格式化
│   └── storage.ts                   # 本地存储跨端适配
│
├── components/                      # 公共组件
│   ├── AuthGuard.tsx                # 登录守卫（受限操作拦截弹窗）
│   ├── EmptyState.tsx               # 空状态占位
│   ├── LoadingState.tsx             # 加载中骨架屏
│   ├── PriceTag.tsx                 # 价格标签（含议价标识）
│   └── MerchantBadge.tsx            # 商家认证标识
│
└── pages/
    ├── home/                        # Tab 1: 首页
    │   ├── index.tsx                # 首页主界面
    │   ├── index.config.ts
    │   ├── index.scss
    │   ├── components/
    │   │   ├── SearchBar.tsx        # 顶部搜索栏
    │   │   ├── HotBearings.tsx      # 热门轴承
    │   │   ├── RecommendedMerchants.tsx  # 推荐商家
    │   │   └── SearchResultList.tsx # 搜索结果列表
    │   └── bearingDetail/           # 轴承详情（子页面）
    │       ├── index.tsx
    │       ├── index.config.ts
    │       └── index.scss
    │
    ├── merchant/                    # Tab 2: 入驻/商家
    │   ├── index.tsx                # 根据状态切换视图
    │   ├── index.config.ts
    │   ├── index.scss
    │   ├── components/
    │   │   ├── ApplyForm.tsx        # 入驻申请表单
    │   │   ├── PendingStatus.tsx    # 审核中状态
    │   │   └── ManagePanel.tsx      # 已入驻管理面板
    │   └── merchantDetail/          # 商家详情（子页面）
    │       ├── index.tsx
    │       ├── index.config.ts
    │       └── index.scss
    │
    └── profile/                     # Tab 3: 我的
        ├── index.tsx                # 个人中心
        ├── index.config.ts
        ├── index.scss
        ├── components/
        │   ├── UserHeader.tsx       # 头像/昵称/登录入口
        │   ├── FavoriteList.tsx     # 收藏列表
        │   ├── FollowedList.tsx     # 关注列表
        │   └── HistoryList.tsx      # 浏览记录
        └── settings/                # 设置子页面
            ├── index.tsx
            └── index.config.ts
```

## 认证流程

经 BFF 代理 Identity，前端不直连 Identity。

### Token 获取

```
用户操作          Taro 客户端               Identity 服务            API 服务
────────         ──────────               ──────────             ────────
打开APP    →     检查本地 Token
                ├─ 有效 → 直接进首页
                └─ 无/过期 → 进首页(游客模式)

点击登录    →     跳转登录页
输入手机号密码 →  POST /connect/token     →  验证凭据
                     (grant_type=password)      签发 token
              ←  access_token + refresh_token
               存储 Token + device_id

请求 API    →     Header: Bearer {token}  →  验证 JWT
              ←  200 OK / 401 Unauthorized

401 响应    →     POST /connect/token
                  (grant_type=refresh_token)
              ←  新 token → 重放原请求

退出登录    →     清除本地 Token          →  无（无状态）
```

### Token 存储策略

| Token | 存储方式 | 说明 |
|---|---|---|
| access_token | 内存变量 | 不持久化，防泄露 |
| refresh_token | 本地存储 | 持久化，用于自动刷新 |
| device_id | 本地存储 | GUID，绑定刷新令牌 |

### 小程序特殊路径

微信小程序可用手机号快捷登录（SMS grant），无需输入密码。

## 部署架构

### 与 BFF 的关系

Taro 与 Mobile BFF 独立部署，各司其职：

| 项目 | 职责 | 域名 | 容器镜像 |
|------|------|------|----------|
| OpenFindBearings.Taro | 前端 H5 静态文件 | mobile.515813.xyz | nginx:alpine |
| OpenFindBearings.Mobile | BFF API 代理 | bff.515813.xyz | aspnet:10.0 |

Taro H5 构建产物打包到 nginx 容器，通过 Ingress 暴露公网域名。所有 API 请求走 BFF 域名，BFF 再通过 K8s 内部网络代理到 API/Identity。

### 域名规划

| 域名 | 用途 | TLS |
|------|------|-----|
| mobile.515813.xyz | Taro H5 静态文件 | cert-manager 自动签发 |
| bff.515813.xyz | BFF API 代理 | cert-manager 自动签发 |
| auth.abcsxl.com | Identity OAuth（登录页/回调） | 已部署 |

### Dockerfile

Taro 独立构建，不打包进 BFF 镜像：

```dockerfile
# Stage 1: 构建 Taro H5
FROM node:20-alpine AS build
WORKDIR /app
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
```

### nginx.conf

```nginx
server {
    listen 80;
    server_name mobile.515813.xyz;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # 静态资源缓存（Taro 构建产物带 hash）
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA 回退
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### K3s 部署

| 资源 | 名称 | 说明 |
|------|------|------|
| Deployment | openfindbearings-taro | 1 副本，nginx 容器 |
| Service | openfindbearings-taro | ClusterIP，port 80 → targetPort 80 |
| Ingress | openfindbearings-taro-ingress | host: mobile.515813.xyz，TLS 自动签发 |

### CI/CD

Release 发布时 CI/CD 自动构建 Docker 镜像（Node.js 编译 Taro → nginx 打包），推送 GHCR，kubectl set image 更新 K3s Deployment。

## API 对接

所有 API 请求走 BFF 域名 `bff.515813.xyz/mobile/*`，不直连 API 或 Identity。

### 基础地址

```typescript
// H5 模式：相对路径（同源/nginx 代理）
// 小程序/App 模式：BFF 公网域名
function getBaseUrl(): string {
  if (Taro.getEnv() === Taro.ENV_TYPE.WEB) return ''
  return process.env.TARO_APP_BFF_BASE_URL || 'https://bff.515813.xyz'
}
```

### 公开端点（无需登录）

| 端点 | 方法 | 用途 |
|------|------|------|
| `/mobile/home` | GET | 首页聚合（热门轴承+推荐商家+品牌+类型） |
| `/mobile/bearings/search` | GET | 轴承搜索 |
| `/mobile/bearings/{id}` | GET | 轴承详情 |
| `/mobile/bearings/{id}/merchants` | GET | 轴承在售商家 |
| `/mobile/merchants/search` | GET | 商家搜索 |
| `/mobile/merchants/{id}` | GET | 商家详情 |
| `/mobile/merchants/{id}/bearings` | GET | 商家在售商品 |
| `/mobile/config` | GET | 站点配置（名称/备案/客服） |

### 认证端点（BFF 代理 Identity）

| 端点 | 方法 | 用途 |
|------|------|------|
| `/mobile/auth/login` | POST | 密码登录（grant_type=password） |
| `/mobile/auth/login-sms` | POST | 短信登录/注册（grant_type=sms） |
| `/mobile/auth/refresh` | POST | 刷新令牌（grant_type=refresh_token） |
| `/mobile/auth/send-sms` | POST | 发送验证码 |

### 需登录端点

| 端点 | 方法 | 认证 | 用途 |
|------|------|------|------|
| `/mobile/profile` | GET | Bearer | 用户资料聚合 |

### 商家管理端点（直连 API，需 Bearer）

入驻申请等商家管理功能仍直连 API 端点（BFF 暂不代理），通过 BFF 同域 nginx 反代或 CORS 跨域访问：

| 端点 | 方法 | 认证 | 用途 |
|------|------|------|------|
| `/api/merchant/apply` | POST | Bearer | 申请入驻（预留，未实现） |
| `/api/merchant/profile` | GET/PUT | Bearer | 店铺信息 |
| `/api/merchant/bearings` | GET/POST | Bearer | 在售商品管理 |
| `/api/merchant/staff` | GET/POST/DELETE | Bearer | 员工管理 |

## 实施步骤

| 步骤 | 内容 | 预计 |
|---|---|---|
| 1 | 清理项目、重建 package.json、config | 基础搭建 |
| 2 | API 封装层（request.ts + Token 管理） | 认证基础 |
| 3 | Zustand stores + 跨端存储适配 | 状态管理 |
| 4 | TabBar + 三个页面骨架 + 路由 | 框架成型 |
| 5 | 首页搜索 + 轴承/商家结果 | 核心功能 |
| 6 | 轴承详情 + 商家详情 | 信息展示 |
| 7 | 登录/注册流程 | 认证对接 |
| 8 | 我的页面（收藏/关注/浏览记录） | 个人功能 |
| 9 | 入驻申请 + 商家管理 | 商家功能 |
| 10 | H5/小程序/APP 多端适配调试 | 平台适配 |

## 架构决策

| 决策项 | 选择 | 理由 |
|---|---|---|
| 为什么不用 MAUI | Taro | MAUI 无法编译微信小程序；Taro 一套代码覆盖 H5/小程序/RN |
| UI 库选 NutUI | NutUI | 京东出品，与 Taro 同生态，组件丰富且风格统一 |
| 状态管理用 Zustand | Zustand | 轻量无模板代码，支持 persist 中间件实现跨端持久化 |
| Token 不持久化 access_token | 安全 | access_token 有效期短（10 分钟），内存存储防泄露；refresh_token 持久化用于自动续期 |
| 认证走 Identity OAuth | 复用 | 与 Admin/Web 共用同一 Identity 认证中心，用户数据统一 |
| Taro 与 BFF 分离部署 | 独立容器 | 前端静态文件用 nginx 更轻量、可 CDN 缓存；BFF 用 ASP.NET Core 专注 API 代理；两者独立扩缩容 |
| API 走 BFF 域名 | bff.515813.xyz | 避免跨域；BFF 聚合请求减少前端请求次数；API 无需公网暴露 |
