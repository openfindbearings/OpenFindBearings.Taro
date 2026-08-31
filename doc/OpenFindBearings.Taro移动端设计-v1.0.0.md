# OpenFindBearings.Taro 移动端设计 v1.0.0

## 概述

OpenFindBearings.Taro 是统一的移动端入口，基于 Taro 4.x + React 18 + TypeScript 构建，一套代码编译到 H5（浏览器）、微信小程序、Android/iOS 原生 APP（React Native），替代原 MAUI + 微信小程序分开做的方案。

## 变更日志

### v1.0.0 (2026-08-31)

- 初始版本，完成整体架构设计与技术选型。

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

首页 API 全部公开（`/api/public/*`），无需登录即可使用。

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

与 Identity 对接保持现有 OAuth 模型。

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

## API 对接

### 公开端点（无需登录）

| 端点 | 方法 | 用途 |
|---|---|---|
| `/api/public/bearings` | GET | 轴承搜索（关键词/品牌/类型/尺寸） |
| `/api/public/bearings/{id}` | GET | 轴承详情 |
| `/api/public/merchants` | GET | 商家搜索 |
| `/api/public/merchants/{id}` | GET | 商家详情 |
| `/api/bearings/{id}/merchants` | GET | 轴承在售商家 |
| `/api/mobile/config` | GET | 站点配置（名称/备案/客服） |

### 认证端点

| 端点 | 方法 | 认证 | 用途 |
|---|---|---|---|
| `/connect/token` | POST | Basic | 登录/注册/刷新 |

### 需登录端点

| 端点 | 方法 | 认证 | 用途 |
|---|---|---|---|
| `/api/account/me` | GET | Bearer | 用户信息 |
| `/api/merchant/apply` | POST | Bearer | 申请入驻 |
| `/api/merchant/profile` | GET/PUT | Bearer | 店铺信息 |
| `/api/merchant/bearings` | GET | Bearer | 在售商品管理 |
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
