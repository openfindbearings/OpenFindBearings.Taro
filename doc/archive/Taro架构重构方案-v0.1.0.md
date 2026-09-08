# Taro 移动端架构重构方案（讨论稿 / 待实施版）

> **状态**：核心决策已定稿，待开始实施
> **版本**：v0.6.0
> **日期**：2026-09-03
> **目标**：解决 NavBar 不统一、主题系统混乱、平台代码差异大、整体一致性问题
> **适用版本**：Taro 3.6.40
> **目标平台**：H5、Android（React Native）、iOS（React Native）、微信小程序、抖音小程序（暂缓）

---

## 一、问题诊断

### 1.1 NavBar 现状

| 页面 | 标题位置 | 返回按钮 | 右侧图标 | 一致性 |
|------|----------|----------|----------|--------|
| 首页（`pages/home/index`） | 无 NavBar | 无 | 无 | 缺 |
| 商家（`pages/merchant/index`） | 居中 "入驻" | 无 | 无 | 不一致 |
| 我的（`pages/my/index`） | 居中 "我的" | 无 | Bell + Settings 两个 | 偏多 |
| 设置（`pages/my/settings`） | 居中 "设置" | 有 | Settings 图标（错误） | 错误 |
| 搜索（`pages/home/search`） | 居中 "搜索" | 有 | 无 | OK |
| 商家详情 | 待开发 | 待定 | 待定 | - |
| 轴承详情 | 待开发 | 待定 | 待定 | - |

**问题**：
- 三个一级 tab 页（首页/商家/我的）的 NavBar 形态都不一样
- 设置页的"设置图标"是用来进设置页的，放在设置页内是逻辑错误
- 我的页 Bell + Settings 两个右侧图标，过于杂乱
- 各页 SCSS 各自实现一遍 NavBar，命名/颜色/尺寸都不统一

### 1.2 主题系统现状

| 平台 | 实现方式 | 运行时切换 | 维护性 |
|------|----------|------------|--------|
| H5 | `theme.scss` 定义 CSS 变量 + `data-theme` 属性 | 支持 | 较好 |
| RN | `_rn.scss` 硬编码 SCSS 变量 | 不支持（编译时定死暗色） | 差 |
| 微信小程序 | 继承 H5 风格但用 SCSS 硬编码 | 实际不支持 | 差 |

**问题**：
- RN 端主题变量硬编码在 `_rn.scss`，浅色/深色两套都写死，无法运行时切换
- 颜色值散落在多个文件中，命名/数值有偏差
- 暗色模式在 H5 有时生效，有时不生效（class 应用时机问题）

### 1.3 TabBar 现状

| 平台 | 实现方式 | 备注 |
|------|----------|------|
| H5 | `CustomTabBar` 浮动组件 + Lucide 图标 | OK |
| RN | `CustomTabBar` 浮动组件 + Lucide 图标 | OK |
| 微信小程序 | 原生 tabBar（app.config.ts 缺配置） | 缺 PNG 图标，缺配置 |

**问题**：
- 微信小程序原生 tabBar 缺 PNG 图标资源 + 缺 app.config.ts 配置
- 三个平台未统一调用方式

### 1.4 代码风格现状

- 各页面 SCSS 命名不一致（`home`/`home-page`/`homePage` 混用）
- 颜色值硬编码（`#2563EB`、`#1E293B` 等散落各处）
- 字体大小硬编码（`font-size: 12px` / `13px` / `14px` 等）
- 圆角值不一致（`8px` / `10px` / `12px`）

---

## 二、目标架构

### 2.1 设计原则

- **一致优先**：所有页面共用 NavBar/TabBar 组件，禁止各自实现
- **平台统一**：H5/RN/小程序 三端代码尽量复用，仅在样式层做平台适配
- **主题可靠**：浅色/深色切换稳定可预期，所有颜色经主题变量
- **简洁现代**：清新蓝白主色，圆角统一，间距体系化

### 2.2 目标目录结构

```
src/
├── app.tsx                  # 入口组件
├── app.scss                 # 全局样式（仅 H5/小程序）
├── app.config.ts            # 全局路由 + tabBar 配置（小程序专用）
├── styles/
│   ├── _colors.scss         # 统一颜色变量（H5/RN/小程序共享）
│   ├── _rn.scss             # RN 编译期 SCSS 变量（仅 RN）
│   ├── _variables.scss      # 字号/间距/圆角/阴影体系
│   └── theme.scss           # H5 CSS 变量（仅 H5）
├── components/
│   ├── NavBar/              # 统一导航栏组件
│   │   ├── index.tsx
│   │   └── index.scss
│   ├── CustomTabBar/        # 自定义底栏（H5/RN）
│   │   ├── index.tsx
│   │   └── index.scss
│   ├── EmptyState/          # 空状态组件
│   ├── LoadingState/        # 加载状态组件
│   └── ListItem/            # 通用列表项
├── pages/
│   ├── home/
│   │   ├── index.tsx
│   │   ├── index.scss
│   │   └── search.tsx
│   ├── merchant/
│   │   ├── index.tsx
│   │   ├── index.scss
│   │   ├── apply.tsx        # 入驻申请
│   │   └── detail.tsx       # 商家详情
│   ├── bearing/
│   │   ├── index.tsx
│   │   ├── index.scss
│   │   └── detail.tsx       # 轴承详情
│   ├── my/
│   │   ├── index.tsx
│   │   ├── index.scss
│   │   ├── settings.tsx     # 设置
│   │   ├── favorites.tsx    # 收藏
│   │   ├── followed.tsx     # 关注
│   │   └── history.tsx      # 历史
│   └── login/
│       └── index.tsx
├── api/                    # 接口层（统一封装，跨端通用）
│   ├── request.ts          # fetch/axios 封装
│   ├── auth.ts             # 认证接口
│   ├── bearing.ts          # 轴承 API
│   ├── merchant.ts         # 商家 API
│   ├── user.ts             # 用户 API
│   ├── config.ts           # 配置 API
│   └── errorCode.ts        # 业务错误码映射
├── services/               # 业务服务层
│   ├── authService.ts      # 登录流程编排
│   └── merchantService.ts  # 商家入驻流程
├── platforms/              # ⭐ 平台适配层（最关键）
│   ├── index.ts            # 统一对外接口
│   ├── login.ts            # 登录（weapp/tt/h5/rn 分支）
│   ├── storage.ts          # 存储适配
│   ├── share.ts            # 分享适配
│   ├── payment.ts          # 支付适配
│   └── scan.ts             # 扫一扫适配
├── stores/                 # Zustand 状态
│   ├── auth.ts
│   ├── theme.ts
│   └── search.ts
├── hooks/                  # 通用 React Hooks
│   ├── useTheme.ts         # 主题切换 hook
│   ├── useRequest.ts       # 数据请求 hook
│   └── useDebounce.ts      # 防抖 hook
├── utils/                  # 通用工具
│   ├── format.ts           # 时间/数字格式化
│   ├── validation.ts       # 校验工具
│   └── logger.ts           # 日志工具
└── assets/                 # 静态资源
    ├── icons/              # 图标 SVG 源
    ├── images/             # 图片
    └── tabbar/             # TabBar PNG（小程序专用）
```

---

## 三、统一组件设计

### 3.1 NavBar 组件

**目录**：`src/components/NavBar/`

**API**：

```tsx
interface NavBarProps {
  /** 标题 */
  title: string
  /** 是否显示返回按钮（默认 false） */
  showBack?: boolean
  /** 返回按钮点击事件，默认 Taro.navigateBack() */
  onBack?: () => void
  /** 右侧自定义 slot */
  rightSlot?: React.ReactNode
  /** 是否固定顶部（默认 true） */
  fixed?: boolean
  /** 背景色（默认透明，使用主题 card 背景） */
  background?: string
}
```

**结构**：

```
┌─────────────────────────────────────────────────┐
│  [<]                标题              [slot]   │  ← 三栏布局
│  flex: 60px         flex: 1          flex: 60px│     标题始终居中
└─────────────────────────────────────────────────┘
```

**所有页面调用**：

| 页面 | 调用 | 备注 |
|------|------|------|
| 首页 | `<NavBar title="首页" />` | Tab 根页，无返回/无右侧 |
| 商家 | `<NavBar title="入驻" />` | Tab 根页，无返回/无右侧 |
| 我的 | `<NavBar title="我的" rightSlot={<SettingsIcon onClick={...} />} />` | 右上去设置 |
| 设置 | `<NavBar title="设置" showBack />` | 有返回，无右侧 |
| 搜索 | `<NavBar title="搜索" showBack />` | 有返回 |
| 商家详情 | `<NavBar title={merchantName} showBack rightSlot={<BellIcon />} />` | 有返回 |
| 轴承详情 | `<NavBar title={bearingName} showBack rightSlot={<HeartIcon onClick={toggleFav} />} />` | 有返回 |
| 入驻申请 | `<NavBar title="入驻申请" showBack />` | 有返回 |
| 收藏/关注/历史 | `<NavBar title="我的收藏" showBack />` | 有返回 |
| 登录 | `<NavBar title="登录" showBack />` | 有返回 |

### 3.2 CustomTabBar 组件

**目录**：`src/components/CustomTabBar/`

**三个平台实现**：

- H5：浮动底栏组件（已存在，需重构）
- RN：浮动底栏组件（同 H5 组件）
- 微信小程序：原生 tabBar（`app.config.ts` 配置 + `static/tabbar/*.png` 图标）

**配置表**：

```typescript
const tabs = [
  { key: 'home',     text: '首页',  pagePath: 'pages/home/index' },
  { key: 'merchant', text: '入驻',  pagePath: 'pages/merchant/index' },
  { key: 'my',       text: '我的',  pagePath: 'pages/my/index' }
]
```

**Tab 居中图标放大效果**（已实现）：商家 tab 在 `merchant.approved === true` 时显示大圆 + 商家 logo（已有）

**Tab 图标**（统一标准）：

| 平台 | 选中态 | 未选中态 |
|------|--------|----------|
| H5/RN | Lucide 图标 + 主色 | Lucide 图标 + 灰色 |
| 小程序 | `static/tabbar/{name}-active.png` | `static/tabbar/{name}.png` |

**待生成 PNG 图标**：
- `home.png` / `home-active.png`（房屋）
- `merchant.png` / `merchant-active.png`（店铺）
- `my.png` / `my-active.png`（用户）

PNG 规格：81×81 px，单色（与 Lucide 一致），可从 Lucide 网站下载 SVG 转换。

---

## 四、主题系统

### 4.1 颜色体系

**主色调**：清新蓝 `#2563EB`（亮色）/ `#60A5FA`（暗色）

**浅色主题（清新明亮）**：

```
--bg-page:        #F8FAFC
--bg-card:        #FFFFFF
--bg-input:       #F1F5F9
--text-primary:   #0F172A
--text-secondary: #475569
--text-tertiary:  #94A3B8
--primary:        #2563EB
--primary-light:  #DBEAFE
--primary-hover:  #1D4ED8
--success:        #10B981
--warning:        #F59E0B
--danger:         #EF4444
--border:         #E2E8F0
--shadow:         0 1px 2px rgba(15, 23, 42, 0.04)
```

**深色主题（柔和护眼）**：

```
--bg-page:        #0F172A
--bg-card:        #1E293B
--bg-input:       #334155
--text-primary:   #F1F5F9
--text-secondary: #CBD5E1
--text-tertiary:  #94A3B8
--primary:        #60A5FA
--primary-light:  #1E3A5F
--primary-hover:  #93C5FD
--success:        #34D399
--warning:        #FBBF24
--danger:         #F87171
--border:         #334155
--shadow:         0 1px 2px rgba(0, 0, 0, 0.2)
```

### 4.2 实现方式

**H5**：
- 在 `src/styles/theme.scss` 定义 `:root` 和 `.theme-dark` 下的 CSS 变量
- 在 `src/app.tsx` 中读取 localStorage 的 `app_theme`，在 `<html>` 上加 `theme-dark` 类
- 各组件 SCSS 用 `var(--bg-card)` 引用

**RN**：
- 在 `src/styles/_rn.scss` 定义 SCSS 变量
- 通过 `process.env.TARO_ENV === 'rn'` 在 import 时按需加载
- 各组件 SCSS 用 `$bg-card` 引用

**微信小程序**：
- 建议复用 RN 的 `_rn.scss`（小程序也不支持 CSS 变量运行时切换）
- 在 `app.config.ts` 配 `darkmode: true`（基础库 2.11.0+）
- 主题切换在 `app.tsx` 调 `wx.setNavigationBarColor` 等

**简化方案（暂定）**：
- H5 用 CSS 变量
- RN/小程序 共用 `_rn.scss`（SCSS 变量）
- 三端只能支持亮色/暗色两套，不可运行时细调
- 主题切换在 H5 由 `theme-dark` 类控制，在 RN/小程序需要重启应用（暂不实现运行时切换）

### 4.3 字号/间距/圆角/阴影体系

**字号**（`--text-xs` 到 `--text-2xl`）：
- `xs: 11px` / `sm: 12px` / `base: 14px` / `md: 15px` / `lg: 17px` / `xl: 20px` / `2xl: 24px`

**间距**（`--space-1` 到 `--space-8`，4 的倍数）：
- `1: 4px` / `2: 8px` / `3: 12px` / `4: 16px` / `5: 20px` / `6: 24px` / `8: 32px`

**圆角**（`--radius-sm` 到 `--radius-xl`）：
- `sm: 6px` / `md: 8px` / `lg: 12px` / `xl: 16px` / `full: 9999px`

**阴影**（`--shadow-sm/md/lg`）：
- `sm: 0 1px 2px rgba(0,0,0,0.04)`
- `md: 0 4px 12px rgba(0,0,0,0.08)`
- `lg: 0 8px 24px rgba(0,0,0,0.12)`

---

## 五、页面重构清单

### 5.1 必须完成（第一阶段）

| # | 页面 | 主要工作 |
|---|------|----------|
| 1 | `src/components/NavBar/` | 新建统一 NavBar 组件 |
| 2 | `src/styles/_colors.scss` | 抽取统一颜色变量 |
| 3 | `src/styles/_variables.scss` | 字号/间距/圆角/阴影 |
| 4 | `src/styles/theme.scss` | 重写 H5 CSS 变量 |
| 5 | `src/styles/_rn.scss` | 重写 RN SCSS 变量 |
| 6 | `src/pages/home/index.tsx` | 使用 NavBar 组件 |
| 7 | `src/pages/merchant/index.tsx` | 使用 NavBar 组件 |
| 8 | `src/pages/my/index.tsx` | 移除 Bell，保留 Settings，统一 NavBar |
| 9 | `src/pages/my/settings.tsx` | 移除右侧设置图标，统一 NavBar |
| 10 | `src/pages/home/search.tsx` | 使用 NavBar 组件 |
| 11 | `src/components/CustomTabBar/` | 重构，统一三端调用 |
| 12 | `src/app.config.ts` | 补充小程序原生 tabBar 配置 |
| 13 | `static/tabbar/*.png` | 生成 6 张 PNG 图标 |
| 14 | `src/app.tsx` | 优化主题应用时机 |

### 5.2 第二阶段（待开发页面）

- `pages/merchant/apply.tsx`（入驻申请）
- `pages/merchant/detail.tsx`（商家详情）
- `pages/bearing/detail.tsx`（轴承详情）
- `pages/my/favorites.tsx`
- `pages/my/followed.tsx`
- `pages/my/history.tsx`
- `pages/login/index.tsx`

### 5.3 第三阶段（优化）

- EmptyState / LoadingState / ListItem 公共组件
- 全部页面用 Zustand 统一状态
- 跨端平台适配文件（`pages/home/index.rn.tsx` 等）

---

## 六、确认决策（v0.6.0 已定稿）

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 首页 NavBar | **普通模式**：NavBar 居中标题"首页"；**简洁模式**：无 NavBar，搜索框+快捷入口垂直居中。预留"鸡汤 tip"位（第二阶段） |
| 2 | 我的页右侧图标 | **保留 Bell + Settings**。Bell = 消息中心（站内通知、版本更新提示、未来推送消息；未来可做分类 tab）。Settings = 进入设置页 |
| 3 | 详情页 NavBar | **只有居中标题**（不强制加图标）。左返回箭头按需，右侧图标仅"我的"根 tab 页有 |
| 4 | 主题切换 | **H5 + Android + iOS 三端运行时切换**（RN 用 `Appearance` + Provider 重新渲染）。**小程序不实现**（多半小程序平台不支持） |
| 5 | 简洁模式 | 无 NavBar + 内容垂直居中；预留"鸡汤 tip"位 |
| 6 | TabBar 居中放大 | **保留现状**（H5/RN/小程序三端统一实现）。商家入驻后大 logo 突出，是吸引商家的核心营销卖点 |
| 7 | 微信小程序 TabBar | **优先自定义 tabBar** + 居中放大（统一三端视觉）。如实在做不到再回退原生 tabBar |

---

## 七、风险与回滚

- 重构后建议保留 git 分支，便于回滚
- 重构前先截图记录各页当前状态，便于对比
- 每次提交后跑 H5 + RN 构建验证

---

## 八、开发规范（多端最佳实践）

### 8.1 分层架构

- **UI 层**：`components/` 和 `pages/`，跨端通用组件，不直接调用平台 API
- **平台适配层**：`services/`、`utils/storage.ts` 等，内部根据 `process.env.TARO_ENV` 选择不同实现
- **业务层**：`stores/`，状态管理，跨端通用

### 8.2 条件编译规则

- ✅ **允许**：`app.tsx` 入口、`app.config.ts` 配置、平台适配层（services/utils 内）
- ❌ **禁止**：业务代码（pages/、components/、stores/）内不写 `// #ifdef`
- 业务代码需要平台能力时，调适配层接口，适配层内做平台分支

### 8.3 样式规范

**布局**：
- 优先使用 Flex 布局（H5/小程序/RN 表现最一致）
- 避免 Grid、Float 等
- 滚动容器用 Taro 的 `ScrollView`，禁用 `document.body.scrollTop` 等
- H5 改子组件样式用 `:global` 或 `style` 属性，**不靠父类选择器**（小程序无样式隔离，H5 有）

**文本**：
- ✅ 文字必须用 `<Text>` 组件包裹，文字样式写在 Text 上
- ❌ 禁止在 View 上写 `font-size`、`color` 等文字样式（RN 强制 Text）

**图标**：
- ✅ 统一用 props 传颜色和尺寸：`<Camera color="#333" size={32} />`
- ❌ 禁止用 className 传颜色（`className='icon-voice'`）— CSS 变量在 RN/小程序不可靠
- 颜色值用主题变量（如 `color={theme.primary}`），不硬编码

**事件对象差异**：
- 小程序 `e.detail.value`，H5 `e.target.value`
- 统一用 Taro 受控组件 `value` + `onChange`（Taro 内部已做平台适配）

**渐变/特殊效果**：
- RN 端禁用 `linear-gradient`，改用纯色
- 阴影统一用 `--shadow-sm/md/lg` 体系

**字号/字重**：
- 字号用 `--text-*` 变量
- 字重只用 `normal`(400) 和 `bold`(700)，RN 端不识别 500/600

**数值单位**：
- 间距/圆角必须带单位（`8px`）
- 禁止 `line-height: 1.2`（无单位），必须 `line-height: 20px`

### 8.4 性能规范

- **长列表**：搜索结果/收藏/历史等长列表用 `VirtualList`（Taro 内置）
- **大图**：`Image` 组件必须传 `mode='widthFix'` 或固定宽高，禁止缩放图
- **频繁更新**：用 `CustomWrapper` 包裹，避免整页 diff
- **避免一次性 setData 大量数据**

### 8.5 路由规范

**H5**：
- `app.config.ts` 必须设 `h5.router.mode: 'hash'`，避免 History 模式后退按钮异常
- 动态路由用 `Taro.navigateTo({ url: '/pages/xxx?key=value' })`，参数放 query

**小程序**：
- Tab 页用 `switchTab`，非 tab 页用 `navigateTo`
- 返回层级超过 5 层用 `redirectTo` 重置

**RN**：
- 与 H5 一致

### 8.6 资源规范

**静态图片**：
- 必须 `import` 后用对象引用：避免打包后 404
- 动态图片（API 返回 URL）直接 `<Image src={url} />`，不做处理

**图标**：
- 全部用 `lucide-react-taro`
- 不要本地 SVG 文件（小程序不兼容）

### 8.7 平台兼容表

| 特性 | H5 | 小程序 | RN | 处理 |
|------|-----|--------|-----|------|
| `linear-gradient` | ✅ | ✅ | ❌ | RN 改纯色 |
| CSS 变量运行时切换 | ✅ | 部分 | ❌ | RN 用 SCSS 变量 |
| `env(safe-area-inset-*)` | 部分 | ✅ | ❌ | RN 改固定值 |
| `position: fixed` | ✅ | ✅ | ⚠️ | RN 用 SafeAreaView |
| `<Image>` 远程 URL | ✅ | ✅ | ✅ | 直接用 |
| `border-radius: 50%` | ✅ | ✅ | ✅ | OK |
| `transition`/`animation` | ✅ | 部分 | ❌ | RN 不支持 |
| `object-fit` | ✅ | ✅ | ❌ | RN 用 resizeMode |
| `background-image` | ✅ | ❌ | ❌ | 改用 solid color |

### 8.8 Babel 配置

`babel.config.js` 必须配置 `@babel/preset-env`，目标环境设低（iOS 9/Android 5）以兼容低端 WebView。

### 8.9 图标方案确认（基于多份资料对照）

**结论：使用 `lucide-react-taro`**

依据：
- 多端支持：H5/小程序/RN 全覆盖（SVG → DataURL → Image 渲染）
- Tree Shaking：每个图标独立模块，按需打包
- 动态颜色：`color` prop 运行时切换
- TS 类型完整
- 提供 `LucideTaroProvider` 全局默认色和尺寸
- 提供 `taro-lucide-tabbar` CLI 工具生成小程序 TabBar PNG

**关键避坑**：
- 小程序 SVG 不继承 `currentColor`，必须显式 `color` prop 或包 `LucideTaroProvider`
- 颜色值用主题变量（如 `color={theme.primary}`），不硬编码 `#2563EB`

**全局配置**（`src/app.tsx`）：

```tsx
import { LucideTaroProvider } from 'lucide-react-taro'

<LucideTaroProvider defaultColor="#1E293B" defaultSize={20}>
  {/* 全局图标默认 #1E293B + 20px */}
</LucideTaroProvider>
```

---

## 九、确认决策（v0.2.0 已定稿）

### 9.1 7 个决策项（基于用户 2026-09-03 反馈）

| # | 决策 | 实施方案 |
|---|------|----------|
| 1 | **首页 NavBar**：普通模式加 NavBar 居中标题"首页"；简洁模式无 NavBar | 详细见 3.1 |
| 2 | **我的页右侧**：保留 Bell（消息）+ Settings（设置）两个图标 | Bell 点入消息中心页 |
| 3 | **设置/详情页右侧**：无图标，仅居中标题文字 | 详细见 3.1 |
| 4 | **主题切换**：H5 + Android + iOS 三端都支持深色运行时切换；小程序不强求 | 详细见 4.4 |
| 5 | **简洁模式首页**：无 NavBar，内容垂直居中 | 详细见 3.1 |
| 6 | **TabBar 居中放大效果**：保留（商家入驻后显示大圆 logo） | 详细见 3.2 |
| 7 | **小程序 TabBar**：原生 tabBar + PNG 图标 | 详细见 3.2 |

### 9.2 新增：消息中心

**目的**：站内通知统一入口，覆盖以下消息：
- App 版本更新（启动检测到的最新版）
- 系统公告
- 商家审核进度（已入驻用户）
- 收藏的轴承有更新
- 关注的商家有新产品

**页面**：`src/pages/message/index.tsx`

**Tab 分类**（借鉴消息中心常规做法）：
- 全部
- 系统（版本更新、公告）
- 商家（审核进度、商家公告）
- 互动（收藏更新、关注更新）

**入口**：我的页 NavBar 右侧 Bell 图标

**实施阶段**：第二阶段（核心业务页面开发时）

### 9.3 新增：版本更新检测

**逻辑**：
- App 启动时调 `/api/mobile/config/version` 拿最新版本号
- 对比当前 `package.json` 的 version 字段
- 如有更新，推送消息到消息中心
- 可选：弹窗强制/可选升级

**实施阶段**：第三阶段（与消息中心一并实施）

### 9.4 新增：首页"鸡汤小 tip"（可选，预留）

**构思**：简洁模式下可加一条励志小语
**状态**：第二阶段视情况决定

---

## 十、文档历史

| 版本 | 日期 | 状态 | 说明 |
|------|------|------|------|
| v0.1.0 | 2026-09-03 | 暂定版 | 初稿，待用户确认 |
| v0.2.0 | 2026-09-03 | 决策定稿 | 7 个决策项定稿，新增消息中心/版本更新预留 |
| v0.3.0 | 2026-09-03 | 决策修订 | 第 7 项：小程序改回自定义 tabBar |
| v0.4.0 | 2026-09-03 | 决策修订 | 第 7 项：小程序自定义实在做不到回退原生 |
| v0.5.0 | 2026-09-03 | 决策修订 | 第 4 项：小程序争取支持主题切换 |
| v0.6.0 | 2026-09-03 | 决策修订 | 第 4 项：小程序不实现主题切换；第 7 项：大 logo 小程序争取与其他端统一（保留自定义优先） |


