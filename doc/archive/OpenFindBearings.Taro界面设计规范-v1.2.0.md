# OpenFindBearings.Taro 界面设计规范

> 当前版本：v1.2.0
> 日期：2026-09-07
> 阶段：RN 优先（Android/iOS 标准 RN 实现）；H5、微信小程序为后续阶段
> 对应重构方案：Taro架构重构方案-v1.7.0

---

## 0. 本版变更摘要（相对 v1.1.0）

- 主色由 `#2563EB` 改为天空蓝系 `#0EA5E9`（图标/装饰）+ `#0284C7`（文字级）+ `#0369A1`（深色档），满足 WCAG AA 对比度。
- 度量体系由"H5 优先 + CSS 变量"改为 **RN 优先 + dp 直写**：`config.rn.postcss` 设 `scalable:false` + `pxtransform.config.deviceRatio:{750:2}`，SCSS 里 `Npx` 编译为 RN 纯数值 `N`（= N dp），所见即所得。
- TabBar 由 48px 改为 **56dp**（Material Bottom Navigation 标准），商家大圆 56dp、上浮 14dp、Android 阴影靠 inline `elevation`。
- NavBar 由"各页内联"改为**独立组件** `components/NavBar`，标准安全区（`SafeAreaProvider` + `useSafeAreaInsets`），右侧图标用声明式 `rightIcons` prop（修复 Taro RN className 文件作用域导致的图标紧贴 bug）。
- 新增 `components/PageLayout` 统一"顶栏 + 滚动内容 + 底栏"骨架，内容容器 `flexGrow:1` 支持占位页垂直居中。
- 会员卡改用 `react-native-linear-gradient` 原生渐变（主题蓝 `#0EA5E9→#0369A1`），替代此前"RN 不支持渐变"的纯色妥协。
- 图标统一走 `components/Icon` 抽象层：RN=`lucide-react-native`+`react-native-svg`，H5=`lucide-react`（后续阶段）。
- 主题色自选功能：本轮**未实现**，列为下一阶段（A 方案预制色板）。

---

## 1. 色彩系统

### 1.1 色彩 Token（`src/styles/_rn.scss`，编译期 SCSS 变量）

> RN 端不使用 CSS 变量（Metro 不支持 `var()` 回退语法），全部用 SCSS 变量硬编码。
> 下值为 RN dp 直写口径；H5/小程序阶段再引入 CSS 变量运行时切换。

| Token | 值 | 用途 | 对比度说明 |
|-------|------|------|-----------|
| `$primary` | `#0EA5E9` | 图标、徽标、装饰、实心圆底 | 对白底 2.77:1，禁止用于文字 |
| `$primary-text` | `#0284C7` | 文字级主色：tab 选中、链接、强调文字 | 对白底 4.09:1，达 AA |
| `$primary-deep` | `#0369A1` | 深色档：会员卡渐变尾、按压态 | 对白底 5.96:1，AA 全通过 |
| `$primary-light` | `#E0F2FE` | 主色浅底（占位图标圆底） | — |
| `$primary-hover` | `#0284C7` | 主色悬停/按压 | — |
| `$bg-page` | `#F5F7FA` | 页面背景（统一加深，白卡对比更清晰） | — |
| `$bg-card` | `#FFFFFF` | 卡片背景 | — |
| `$bg-input` | `#F1F5F9` | 输入框/标签背景 | — |
| `$text-primary` | `#0F172A` | 主文本 | — |
| `$text-secondary` | `#475569` | 次文本 | — |
| `$text-tertiary` | `#64748B` | 弱文本、占位（由 #94A3B8 提深达 AA 4.76:1） | — |
| `$text-on-primary` | `#FFFFFF` | 主色上的文字 | — |
| `$border` | `#E2E8F0` | 边框/分割线 | — |

**快捷入口实心圆（三钮，v1.7.0 由浅底彩图标改实心彩底白图标）：**

| 入口 | 圆底 Token | 值 | 图标 |
|------|-----------|------|------|
| 讲语音 | `$gradient-voice` | `#0EA5E9`（实心蓝） | Mic 28dp 白 |
| 拍轴承 | `$gradient-camera` | `#10B981`（实心绿） | Camera 28dp 白 |
| 扫条码 | `$gradient-scan` | `#F59E0B`（实心橙） | ScanLine 28dp 白 |

> 命名沿用 `gradient-*` 前缀（历史），实际为**纯色**（RN 0.70 SCSS 不支持 `linear-gradient`，实心圆用纯色即可）。会员卡渐变是唯一使用真渐变处（靠原生 `LinearGradient` 组件，非 CSS）。

### 1.2 主题切换

| 平台 | 状态 | 说明 |
|------|------|------|
| RN（本轮） | **锁定浅色** | `stores/theme.ts` 的 `setMode` 对非 light 选择拦截并 toast"深色模式将在后续版本支持"，避免"设置页能变暗别页不变"的分裂 |
| H5（后续） | 计划 | CSS 变量 + `[data-theme]` 运行时切换 |
| 微信小程序（后续） | 计划 | 多数小程序不做深色 |

### 1.3 主题色自选（下一阶段，未实现）

计划方案 A：预制色板（天空蓝默认/翡翠绿/琥珀橙/玫红/紫罗兰/石墨，覆盖暖冷），不做自定义取色。架构：新建 `ThemeColorContext` + `usePrimary()`，Provider 挂 `app.rn.tsx`，把主色染色元素改 inline style（SCSS `$primary` 编译期不可运行时改）。深色模式下主题色仍生效（用调过对比度的深色变体）。

---

## 2. 度量体系（RN 优先，本版核心变更）

### 2.1 dp 直写机制

Taro RN 默认对 SCSS 的 `Npx` 做两级缩放，导致真机尺寸偏小一半。v1.7.0 通过 `config/index.ts` 双开关关闭缩放：

```ts
rn: {
  postcss: {
    scalable: false,                              // 关第二级：px→PX，运行时不再 scalePx2dp
    pxtransform: { config: { deviceRatio: { 750: 2 } } }  // 关第一级：rootValue=1，px 不减半
  }
}
```

效果：SCSS 里写 `44px` → RN bundle 得纯数值 `44` → 渲染 44dp。**所见即所得，无需 ×2 心智负担**。

> 注意：此配置只作用于 RN 编译链，H5/小程序仍走各自 rem/rpx 缩放。

### 2.2 尺寸 Token

| 类别 | Token | 值(dp) | 依据 |
|------|-------|--------|------|
| NavBar | `$navbar-height` | 44 | iOS HIG 标准 |
| NavBar 搜索态 | `$navbar-height-search` | 48 | 贴近京东/淘宝搜索栏 |
| NavBar 侧栏 | `$navbar-side-width` | 72 | 右侧双 32dp 图标=64 + 8 富余；返回按钮 44 亦容纳 |
| NavBar 图标 | `$navbar-icon-size` | 24 | 视觉尺寸 |
| NavBar 返回触控 | `$navbar-icon-touch` | 44 | Material 最小触控目标 |
| TabBar | `$tabbar-height` | 56 | Material Bottom Navigation |
| TabBar 图标 | `$tabbar-icon-size` | 24 | — |
| TabBar 文字 | `$tabbar-text-size` | 12 | — |
| TabBar 商家大圆 | `$tabbar-highlight-size` | 56 | 入驻后突出 |
| TabBar logo | `$tabbar-logo-size` | 48 | 大圆内 logo |
| TabBar 上浮 | `$tabbar-highlight-offset` | 14 | 大圆上移量 |
| 快捷入口圆 | `$quick-entry-size` | 56 | 首页三钮实心圆 |
| 快捷入口图标 | `$quick-entry-icon` | 28 | 圆内白图标 |
| 搜索框 | `$search-box-height` | 36 | — |
| 卡片内边距 | `$card-padding` | 16 | — |

### 2.3 字号 / 行高 / 间距 / 圆角

- 字号：`sm 13 / base 14 / md 15 / lg 17 / xl 20`（RN 数值，H5 阶段各自按平台标准）
- 行高：全部落 dp 数值（`xs16 sm18 base20 md21 lg24 xl28 2xl32 4xl40`），RN 要求 lineHeight 为数值
- 间距：`space-1..7 = 4/8/12/16/20/24/28`，`10/12/16 = 40/48/64`
- 圆角：`sm6 md8 lg12 xl16 2xl20 full9999`

### 2.4 RN 样式约束（写码红线）

| 禁止 | 原因 | 替代 |
|------|------|------|
| `gap` | RN 0.70 不支持 | 相邻元素 `margin` |
| 组合选择器 `.a.b` / `.a .b` | RN 忽略 | 独立类（如 `.quick-icon-voice`） |
| `linear-gradient()`（CSS） | RN 不支持 | 纯色；真渐变用 `LinearGradient` 组件 |
| `position: fixed/sticky` | RN 不支持 | flex 列布局 + ScrollView |
| `vh/vw` 单位 | RN 不支持 | PageLayout 用 `getSystemInfoSync().windowHeight` 显式 dp 高度 |
| `var()` 回退语法 | Metro SCSS 不支持 | 裸 SCSS 变量 |
| 百分比 `border-radius` | RN ClassCastException | `999px` 大圆角 |
| `lineHeight`/`fontSize` 带 px 字符串 | RN 要求数值 | dp 数值（dp 直写机制保证） |
| `box-shadow`（Android） | Taro 不转 elevation | inline `elevation` + `shadow*` |

---

## 3. 组件结构

### 3.1 PageLayout（页面骨架，统一五页）

`src/components/PageLayout/`。职责：唯一处定义"根高度 + 顶栏 + 滚动内容 + 底栏"，替代各页重复的 rnHeight / padding-bottom hack。

```tsx
<PageLayout nav={<NavBar .../> | null} tabbar={<CustomTabBar/>} scrollY>
  {内容}   {/* 内部包 ScrollView，contentContainerStyle flexGrow:1 支持子元素 flex:1 垂直居中 */}
</PageLayout>
```

- 简洁首页传 `nav={null}`；非 tab 页（设置/搜索）不传 `tabbar`。
- 根高度：RN 端 `getWindowHeight()`（dp inline），H5/小程序返回 0 走 CSS flex。

### 3.2 NavBar（统一顶栏）

`src/components/NavBar/`。标准安全区结构：外层 View `paddingTop = insets.top`（`useSafeAreaInsets`，背景随外层铺满、与状态栏无缝），内层固定 44/48dp 内容行、垂直居中。

| prop | 作用 |
|------|------|
| `title` | 居中标题（centerSlot 为空时显示） |
| `centerSlot` | 中间自定义内容（首页普通模式传搜索框） |
| `showBack` / `onBack` | 返回按钮（44dp 触控，默认 navigateBack） |
| `rightIcons` | **声明式右侧图标** `[{name,onClick,size?}]`，由 NavBar 内部渲染（32dp 紧凑框，与搜索框 action-icon 同几何） |
| `rightSlot` | 复杂右侧内容（简单图标优先用 rightIcons） |
| `searchMode` | 搜索态：中间铺满搜索框、左右栏缩窄、增高 48dp |

> **关键修复**：`rightIcons` 存在的原因是 Taro RN 的 className 是**文件作用域**——调用方页面写的 `navbar-icon` 类（定义在 NavBar 的 scss）编译期查不到，导致图标触控框/间距全丢、两图标紧贴。改由 NavBar 自己渲染图标，类名回到 NavBar 文件作用域，稳定生效。

### 3.3 CustomTabBar（浮动底栏）

`src/components/CustomTabBar/`。三 tab：首页(Home)/入驻(Store)/我的(User)，中间商家 tab 特殊：

- 未入驻 / 待审核：与普通 tab 完全一致（24dp 图标 + 文字）。
- 已入驻（`merchant_approved === 'true'` 严格判定）：商家 tab 变 56dp 大圆上浮 14dp，有 logo 显示 logo（`<Image>`，加载失败回退默认 Store 图标），无 logo 显示放大的 Store 图标（28dp），带阴影（Android inline `elevation`）。
- 冷启动防跳变：`app.tsx` 启动预读 globalData，CustomTabBar 初始值同步读、异步 storage 兜底。
- tab 切换用 `Taro.redirectTo`（RN 端 switchTab 依赖 tabBar 配置，本项目用浮动自绘底栏）。

### 3.4 Icon（图标抽象层）

`src/components/Icon/`，平台分支文件（Taro RN resolver 优先 `.rn.tsx`）：

| 文件 | 平台 | 库 |
|------|------|-----|
| `index.rn.tsx` | RN | `lucide-react-native` + `react-native-svg`（真 SVG） |
| `index.tsx` | H5/小程序 | `lucide-react`（后续阶段） |

用法：`<Icon name="search" size={24} color="#0284C7" />`。业务代码不直接 import 任何 lucide 包。

---

## 4. 页面布局

### 4.1 首页（普通模式）

```
┌─────────────────────────────────────────────┐
│ [NavBar 搜索态 48dp：铺满搜索框]              │  ScanLine | 输入框 | Mic Camera
├─────────────────────────────────────────────┤
│   (●讲语音)   (●拍轴承)   (●扫条码)          │  实心圆 56dp 白图标 28dp
├─────────────────────────────────────────────┤
│  搜索历史 [Tag][Tag][Tag]            [清空]  │  有历史才显示
├─────────────────────────────────────────────┤
│  热门搜索 [SKF][NSK][6205][6308][...]        │
└─────────────────────────────────────────────┘
   [首页]        [入驻]        [我的]           56dp TabBar
```

### 4.2 首页（简洁模式，`app_settings.simpleHome=true`）

无 NavBar，搜索框 + 三钮**聚成一簇整体垂直居中**（`.home-simple` flex:1 + justify-content:center；搜索框 `width:100%` 不纵向撑开），保留 TabBar。

### 4.3 入驻/商家（`/pages/merchant/index`）

NavBar 标题动态：已入驻"商家"/未入驻"入驻"。占位内容（Store 大图标 + 标题 + 描述）通过 `.placeholder` flex:1 **垂直居中**。已认证后显示店铺管理入口。

### 4.4 我的（`/pages/my/index`）

```
┌─────────────────────────────────────────────┐
│ 我的                    [Bell] [Gear]        │  rightIcons 32dp 紧凑
├─────────────────────────────────────────────┤
│  点击登录 / 头像+昵称+手机号                   │  主题蓝区
├─────────────────────────────────────────────┤
│  我的积分            收支明细 >               │  LinearGradient 渐变卡
│  0 积分                                       │  #0EA5E9→#0369A1
│  积分可兑换现金              [去兑换]         │
├─────────────────────────────────────────────┤
│  (♥)    (👥)    (🕐)    (⊞)                  │  四宫格
│ 收藏轴承 关注商家 浏览历史 全部功能            │
├─────────────────────────────────────────────┤
│        OpenFindBearings v1.0.0               │  版本信息
└─────────────────────────────────────────────┘
```

功能卡四入口：收藏轴承(Heart 红)/关注商家(Users 蓝)/浏览历史(Clock 绿)/全部功能(LayoutGrid 紫)。

### 4.5 设置（`/pages/my/settings`）

NavBar 返回左、标题"设置"居中、无右图标（设置图标是本页入口，在"我的"页右上角）。分组：外观（深色模式-后续支持/首页模式-普通|简洁/字体大小-小|中|大）、消息（推送/广告 toggle）、通用（音效/震动 toggle、版本更新 v1.0.0）、隐私（管理/政策/收集清单/共享清单）、账户（个人信息/服务热线/注销）。底部退出登录 + 协议声明。

### 4.6 搜索结果 / 轴承详情 / 商家详情

沿用既有布局；NavBar 统一返回左、标题居中。搜索框 `width:100%` 铺满。

---

## 5. 技术约束（平台差异）

| 特性 | RN（本轮） | H5（后续） | 微信小程序（后续） |
|------|-----------|-----------|-------------------|
| 度量 | dp 直写（双开关） | rem 缩放 | rpx 缩放 |
| 主题 | SCSS 变量硬编码，锁浅色 | CSS 变量运行时 | CSS 变量 |
| 图标 | lucide-react-native + react-native-svg | lucide-react | 待定 |
| 渐变 | LinearGradient 组件（CSS 不支持） | CSS linear-gradient | 不支持 |
| gap | 不支持→margin | 支持 | 支持 |
| 组合选择器 | 忽略→独立类 | 支持 | 支持 |
| 安全区 | useSafeAreaInsets | env(safe-area-inset) | 自动 |
| TabBar | 浮动自绘 CustomTabBar | 浮动自绘 | 浮动自绘（大圆一致） |
| position fixed/sticky | 不支持 | 支持 | 支持 |

---

## 6. 路由配置

`src/app.config.ts` 注册页面（无原生 tabBar，用浮动 CustomTabBar）：

```
pages/home/index          首页
pages/merchant/index      入驻/商家
pages/my/index            我的
pages/home/search         搜索结果
pages/home/bearingDetail  轴承详情
pages/merchant/merchantDetail 商家详情
pages/my/settings         设置
pages/my/all-features     全部功能
```

各页 `.config.ts` 设 `navigationStyle: 'custom'`（去掉 RN 原生导航栏，用自定义 NavBar）+ `disableScroll: true`（滚动由 PageLayout 统一提供）。

---

## 7. 文件结构

```
src/
  app.config.ts / app.tsx / app.scss
  components/
    PageLayout/    页面骨架（顶栏+滚动+底栏，安全区口径唯一）
    NavBar/        统一顶栏（rightIcons 声明式、标准安全区）
    CustomTabBar/  浮动底栏（商家大圆动态突出）
    Icon/          图标抽象层（index.rn.tsx / index.tsx 平台分支）
  pages/
    home/          index / search / bearingDetail
    merchant/      index / merchantDetail
    my/            index / settings / all-features
  styles/
    _rn.scss       RN dp token + 色板（编译期，主样式来源）
    theme-colors.ts 跨端主题色 hook
  utils/
    safe-area.ts   getWindowHeight / getSafeArea
    use-safe-area.ts(x)  标准安全区 hook（RN 用 useSafeAreaInsets）
    platform.ts    getEnv 平台判定
    storage.ts     异步存储封装（RN 不支持同步 API）
```

---

## 8. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.2.0 | 2026-09-07 | RN 优先度量重构落地：dp 直写双开关、天空蓝对比度色板、PageLayout/NavBar(rightIcons)/CustomTabBar(56dp)/Icon 抽象层、会员卡 LinearGradient 渐变、简洁首页与商家页垂直居中、主题色列下阶段 |
| v1.1.0 | 2026-09-03 | 历史版本（H5 优先、CSS 变量、#2563EB、48px TabBar、NavBar 内联） |
| v1.0.0 | — | 初始设计规范 |
