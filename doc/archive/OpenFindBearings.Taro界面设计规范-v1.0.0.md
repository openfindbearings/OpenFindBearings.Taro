# OpenFindBearings.Taro 移动端界面设计规范

> 当前版本：v1.0.0
> 日期：2026-09-03

## 1. 设计语言

### 1.1 色彩系统

| 语义 | 亮色值 | 暗色值 | 用途 |
|------|--------|--------|------|
| 主色 | `#2563EB` | `#3B82F6` | 按钮、链接、强调 |
| 主色浅 | `#EFF6FF` | `#1E3A5F` | 图标背景、徽章 |
| 主色悬停 | `#1D4ED8` | `#60A5FA` | 交互态 |
| 危险 | `#EF4444` | `#F87171` | 错误、删除 |
| 危险背景 | `#FEF2F2` | `#3B1111` | 危险色块 |
| 成功 | `#16A34A` | `#4ADE80` | 成功状态 |
| 成功背景 | `#F0FDF4` | `#14332A` | 成功色块 |
| 警告 | `#EA580C` | `#FB923C` | 警告状态 |
| 警告背景 | `#FFF7ED` | `#3B2111` | 警告色块 |
| 页面背景 | `#F8FAFC` | `#0F172A` | 页面容器 |
| 卡片背景 | `#FFFFFF` | `#1E293B` | 卡片、输入框 |
| 输入框背景 | `#F1F5F9` | `#334155` | 输入框 |
| 主文本 | `#1E293B` | `#F1F5F9` | 标题、正文 |
| 次文本 | `#64748B` | `#94A3B8` | 副标题、说明 |
| 弱文本 | `#94A3B8` | `#64748B` | 占位符、提示 |
| 分割线 | `#E2E8F0` | `#334155` | 边框、分割 |
| 渐变（首页三个按钮） | 蓝/绿/橙渐变 | 暗色纯色 | 快捷入口背景 |

**图标颜色（暗色主题下高亮）：**
- 讲语音图标：`#2563EB`（亮）/ `#60A5FA`（暗）
- 拍轴承图标：`#16A34A`（亮）/ `#4ADE80`（暗）
- 扫条码图标：`#EA580C`（亮）/ `#FB923C`（暗）

### 1.2 字体

- 字体族：`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
- 标题：17px / 600 / 主文本色
- 正文：15px / 400 / 主文本色
- 副文本：13px / 400 / 次文本色
- 弱文本：12px / 400 / 弱文本色
- RN Android 不支持 500/600 数值 font-weight，只支持 normal(400)/bold(700)

### 1.3 间距与圆角

- 页面水平内边距：16px
- 卡片圆角：12px
- 按钮/输入框圆角：8px
- 图标容器圆角：16px（大图标）/ 8px（小图标）
- 大头像圆角：50%（圆形）
- 阴影：卡片 `0 2px 8px rgba(0,0,0,0.06)`（亮）/ `rgba(0,0,0,0.4)`（暗）

### 1.4 动效

- 暂无过渡动画（React Native 对 transition 支持有限）
- @keyframes slideUp 用于面板从底部滑入

## 2. 页面结构

### 2.1 底部 TabBar（浮动自定义底栏）

**文件：** `src/components/CustomTabBar/index.tsx`

| Tab | 图标 | 激活色 | 文字 |
|-----|------|--------|------|
| 首页 | `House`（lucide-react-taro） | 主色 | 首页 |
| 入驻 | `Store`（未入驻） | 主色 | 入驻/商家 |
| 我的 | `User` | 主色 | 我的 |

- 固定在底部，高度 56px，背景白色/暗色
- 入驻商家 tab 已认证时：圆形图标放大至 48px，突出 12px（transform: translateY(-12px)），带阴影
- 每个 tab 图标尺寸：28px，文字 10px
- 安全区域适配：`padding-bottom: 20px`（RN 环境）

### 2.2 页面布局

**首页（Tab 1）：**
- 顶部：NavBar（仅普通模式显示，简洁模式无 NavBar）
- 搜索框：圆角卡片内含 ScanLine 图标 + 文字输入框 + 麦克风/摄像头两个操作按钮
- 快捷入口：三个圆形渐变按钮（讲语音/拍轴承/扫条码）
- 搜索历史：Tag 列表 + 清空按钮
- 热门搜索：Tag 列表
- 简洁模式（`app_settings.simpleHome=true`）：内容垂直居中，仅显示搜索框 + 三个快捷入口

**入驻/商家（Tab 2）：**
- 顶部：NavBar，标题"入驻"
- 内容区：根据入驻状态显示不同内容
  - 未登录：Store 图标 + "入驻/商家" + "商家入驻申请与店铺管理"占位
  - 待审核：审核中状态提示
  - 已入驻：店铺管理入口

**我的（Tab 3）：**
- 顶部：NavBar，标题"我的"，右侧 Bell 消息图标 + Settings 设置图标
- 用户信息区：蓝色渐变背景，头像 + 昵称 + 手机号
- 积分卡片：白底卡片，我的积分 / 收支明细两项
- 功能菜单：四个横向大图标（收藏轴承/关注商家/浏览历史/更多）
- 版本信息：底部居中

**设置页：**
- 顶部：NavBar + 返回箭头 + "设置"标题
- 分组列表：
  - 显示设置：简洁模式（Toggle）
  - 主题设置：暗黑模式（展开面板：浅色/深色/跟随系统单选）
- 每行：左侧圆形色块图标 + 标签文字 + 右侧箭头或 Toggle

**轴承搜索结果页：**
- 顶部：NavBar + 返回 + 搜索关键字
- 结果列表：轴承型号 + 品牌 + 基本参数

**轴承详情页：**
- 顶部：NavBar + 返回 + 分享图标
- 轴承图片、基本参数、价格、在售商家

**商家详情页：**
- 顶部：NavBar + 返回 + 商家名称
- 商家信息、在售商品列表

### 2.3 NavBar 统一规范

- 高度：48px
- 位置：`position: sticky; top: 0`
- 亮色：白底 + 底部分割线
- 暗色：暗色卡片底 + 暗色分割线
- 标题：17px / 600 / 主文本色
- 返回按钮：32x32 图标

## 3. 主题系统

### 3.1 架构

H5 和 React Native 共用同一套页面代码，通过条件编译实现主题适配：

| 平台 | 实现方式 | 是否支持运行时切换 |
|------|----------|------------------|
| H5 | CSS 变量 + `.theme-dark` class | 是（JS 动态切换） |
| React Native | SCSS 变量（编译时硬编码） | 否（固定暗色） |

### 3.2 H5 主题切换

**文件：** `src/app.tsx`

- 读取 `localStorage('app_theme')`，支持 `light` / `dark` / `system`
- `system` 模式通过 `window.matchMedia('prefers-color-scheme: dark')` 检测系统主题
- 亮色：`:root` + `.theme-light` class
- 暗色：`.theme-dark` class + 对应 CSS 变量覆盖

**CSS 变量定义文件：** `src/styles/theme.scss`

### 3.3 React Native 主题

**文件：** `src/styles/_rn.scss`

- 所有颜色用 SCSS 变量硬编码为暗色值
- RN 不支持：`linear-gradient()`（用纯色替代）、`var()` CSS 变量、`env()`、`transition`、`animation`
- RN 不支持数值 font-weight（除 400/700）

### 3.4 设置页主题面板

- 三选一单选组：浅色 / 深色 / 跟随系统
- 选中项：左侧蓝色圆点指示
- 每个选项有语义化图标和说明文字

## 4. 组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| CustomTabBar | `src/components/CustomTabBar/` | 浮动自定义底栏，支持入驻大圆突出 |
| NavBar | 各页面内联 | 48px 固定顶部导航栏 |

## 5. 路由配置

**文件：** `src/app.config.ts`

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `/pages/home/index` | Tab 1 |
| 入驻 | `/pages/merchant/index` | Tab 2 |
| 我的 | `/pages/my/index` | Tab 3 |
| 设置 | `/pages/my/settings` | 从"我的"进入 |
| 搜索结果 | `/pages/home/search` | 搜索页 |
| 轴承详情 | `/pages/home/bearingDetail` | 轴承详情 |
| 商家详情 | `/pages/merchant/merchantDetail` | 商家详情 |

## 6. 接口对接

| 端点 | 路径 | 用途 |
|------|------|------|
| 首页轴承 | `GET /api/mobile/home` | 聚合数据 |
| 轴承搜索 | `GET /api/mobile/bearings?keyword=` | 轴承列表 |
| 热门轴承 | `GET /api/mobile/bearings/hot` | 热门推荐 |
| 商家搜索 | `GET /api/mobile/merchants?keyword=` | 商家列表 |
| 商家在售轴承 | `GET /api/mobile/merchants/{id}/bearings` | 商家详情 |
| 站点配置 | `GET /api/mobile/config` | 站点名称等 |

## 7. 技术约束

- React Native：不支持 CSS 变量、`linear-gradient`、`env()`、`transition`、`animation`、数值 font-weight
- Taro 3.6.40 + React 18 + TypeScript + Sass + Webpack5
- 图标库：lucide-react-taro v1.5.2
- 状态管理：Zustand
- H5 代理：`/mobile` → `https://bff.515813.xyz`
