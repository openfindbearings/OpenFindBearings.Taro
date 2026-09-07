# Taro UI 组件规范 v1.1.0

## 概述

本文档定义 Taro 移动端的 UI 组件使用规范：图标库、公共组件、样式变量、交互约定。

> 阶段：RN 优先（Android/iOS 标准 RN）。H5、微信小程序为后续阶段，规范中已标注平台分支。
> 对应设计规范：界面设计规范 v1.2.0；重构方案：Taro架构重构方案 v1.7.0。

## 变更日志

### v1.1.0 (2026-09-07)

- 图标库由 `lucide-react-taro` 改为 **`Icon` 抽象层**：RN=`lucide-react-native`+`react-native-svg`，H5=`lucide-react`（`lucide-react-taro` 用了 RN 0.71+ 的 codegenNativeCommands，与 Taro 3.6.40 的 RN 0.70 不兼容，已卸载）。
- 移除"TabBar 用静态 PNG"的旧规范：改用浮动 `CustomTabBar` 组件 + Icon 渲染。
- 新增公共组件规范：`PageLayout` / `NavBar` / `CustomTabBar` / `Icon`。
- 主题色 `#1890ff` → 天空蓝系 `#0EA5E9`/`#0284C7`/`#0369A1`。
- 明确 RN 样式红线：`gap`→margin、禁组合选择器、`redirectTo` 切 tab。

### v1.0.0 (2026-09-01)

- 初始版本，图标规范、组件选型、样式体系。

## 图标体系

### Icon 抽象层（唯一入口）

业务代码统一 `import Icon from '@/components/Icon'`，**不得直接 import 任何 lucide 包**。组件内部按平台分支：

| 文件 | 平台 | 底层库 | 渲染 |
|------|------|--------|------|
| `index.rn.tsx` | RN | `lucide-react-native` + `react-native-svg` | 原生 SVG |
| `index.tsx` | H5/小程序 | `lucide-react` | Web SVG（后续阶段） |

Taro RN 的 Metro resolver 优先解析 `.rn.tsx`，H5 webpack 解析 `.tsx`。

**用法**：

```tsx
<Icon name="search" size={24} color="#0284C7" />
```

- `size`：数值（dp），RN 端直接是 dp。
- `color`：**必须用 color prop 传色**，不要用 `className` 传色（CSS 变量在小程序/RN 不可靠）。默认色由平台决定（浅底深描边）。
- 图标名用 lucide 的 snake_case 字符串（如 `scan_line`/`arrow_left`/`chevron_right`/`layout_grid`）。

**常用图标映射**：

| 场景 | name | 尺寸 |
|------|------|------|
| 搜索框扫码 | `scan_line` | 20 |
| 讲语音 | `mic` | 28（实心圆内）/22（搜索框内） |
| 拍轴承 | `camera` | 28 / 22 |
| 扫条码 | `scan_line` | 28 |
| 返回 | `arrow_left` | 24 |
| 首页 tab | `home` | 24 |
| 商家/入驻 tab | `store` | 24（大圆内 28） |
| 我的 tab | `user` | 24 |
| 消息 | `bell` | 24 |
| 设置 | `settings` | 24 |
| 收藏 | `heart` | 28 |
| 关注 | `users` | 28 |
| 历史 | `clock` | 28 |
| 全部功能 | `layout_grid` | 28 |
| 右箭头 | `chevron_right` | 14-16 |
| 清空 | `trash` | 14 |
| 登录 | `log_in` | 28 |

> 注意 lucide-react-taro 里不存在的名字（`BarChart3`/`MoreHorizontal`/`Grid`）已分别用 `LayoutDashboard`/`Ellipsis`/`LayoutGrid` 替代。

### TabBar 图标

不再使用 PNG。`CustomTabBar` 用 Icon 组件渲染（RN 走 lucide-react-native SVG）。小程序阶段若原生 tabBar 受限再评估 PNG，但当前方案为浮动自绘底栏，全平台一致。

## 公共组件

| 组件 | 路径 | 职责 | 关键 props |
|------|------|------|-----------|
| PageLayout | `components/PageLayout/` | 统一"顶栏+滚动内容+底栏"骨架，安全区/根高度口径唯一 | `nav` `tabbar` `scrollY` `children` |
| NavBar | `components/NavBar/` | 统一顶栏，标准安全区 | `title` `centerSlot` `showBack` `onBack` `rightIcons` `rightSlot` `searchMode` |
| CustomTabBar | `components/CustomTabBar/` | 浮动底栏，商家 tab 动态大圆突出 | 无（内部读 storage/globalData） |
| Icon | `components/Icon/` | 图标抽象层，平台分支 | `name` `size` `color` |
| EmptyState | `components/EmptyState/` | 空状态占位 | `text` `icon` |
| AuthGuard | `components/AuthGuard/` | 登录守卫 | — |
| PriceTag | `components/PriceTag/` | 价格标签（议价标识） | — |
| MerchantBadge | `components/MerchantBadge/` | 商家认证标识 | — |

### NavBar 右侧图标：用 rightIcons，别用 rightSlot 写 navbar-icon

```tsx
// 正确：声明式，类名在 NavBar 文件作用域内，稳定生效
<NavBar title="我的" rightIcons={[
  { name: 'bell', onClick: handleBell },
  { name: 'settings', onClick: handleSettings },
]} />

// 错误：在调用方页面写 className='navbar-icon'，Taro RN className 文件作用域
// 导致该类查不到、触控框/间距丢失、图标紧贴
```

右侧图标 32dp 紧凑触控框（与搜索框 action-icon 同几何），返回按钮 44dp（主操作够点）。

### 第三方组件

未引入 NutUI，使用 Taro 内置组件 + 自定义组件。

**Taro 内置组件**：`View` `Text` `Image` `Input` `Textarea` `Button` `ScrollView`。

> RN 约束：`Text` 的 `fontSize`/`lineHeight` 必须数值；`Image` 用 Taro `<Image>`（非 `<img>`）；长列表用 VirtualList。

## 样式体系

### 命名空间

BEM 命名，以页面/组件名为前缀：

```scss
.bearing-card { }
.bearing-card__header { }
.bearing-card__model { }
.bearing-card--pressed { }   // 状态修饰
```

> RN 红线：不要用组合选择器 `.a.b` / `.a .b`（RN 忽略），状态/变体用**独立类**（如 `.quick-icon-voice`）。

### 主题色 Token（`src/styles/_rn.scss`）

```scss
$primary:        #0EA5E9;   // 图标/徽标/装饰（对白 2.77:1，勿用于文字）
$primary-text:   #0284C7;   // 文字级主色：tab 选中/链接/强调（AA 4.09:1）
$primary-deep:   #0369A1;   // 深色档：会员卡渐变尾/按压（AA 5.96:1）
$primary-light:  #E0F2FE;   // 主色浅底
$success:        #10B981;   // 拍轴承实心圆
$warning:        #F59E0B;   // 扫条码实心圆
$danger:         #EF4444;   // 收藏/退出
$text-primary:   #0F172A;
$text-secondary: #475569;
$text-tertiary:  #64748B;   // 弱文本（提深达 AA）
$bg-page:        #F5F7FA;
$bg-card:        #FFFFFF;
$bg-input:       #F1F5F9;
```

### 度量：dp 直写

RN 端 `config.rn.postcss` 设 `scalable:false` + `deviceRatio:{750:2}`，SCSS `Npx` → RN 纯数值 `N`（= N dp）。写码直接写目标 dp，无需 ×2。详见界面设计规范 v1.2.0 第 2 节。

### 布局：Flex-only

- 只用 Flex 布局，禁 `position: fixed/sticky`（RN 不支持）。
- 滚动区用 `ScrollView` + `flex:1`，配合页面 `.config.ts` 的 `disableScroll:true`（外层不滚、内容区滚）。
- 顶栏/底栏固定靠 PageLayout flex 列结构，非 fixed。

## 页面交互规范

### 加载状态

- 列表加载：`Taro.showLoading({ title:'加载中...', mask:true })`
- 按钮提交：文字变"提交中..."并禁用

### 空状态

```tsx
<EmptyState text='暂无收藏' icon="heart" />
```

### Toast 提示

```typescript
Taro.showToast({ title: '保存成功', icon: 'success' })
Taro.showToast({ title: '操作失败', icon: 'none' })
```

### 页面跳转

```typescript
// 子页面
Taro.navigateTo({ url: '/pages/home/bearingDetail?id=' + id })
// 切 tab（浮动底栏，用 redirectTo，非 switchTab）
Taro.redirectTo({ url: '/pages/my/index' })
```

> RN 端 `switchTab` 依赖 app.config 的 tabBar 配置；本项目用浮动自绘底栏，故 tab 切换统一 `redirectTo`。

### 存储

RN 不支持同步 `getStorageSync`，统一用 `src/utils/storage.ts` 的异步封装（`getItem`/`setItem`/`getObject`/`setObject`）。

## 按压反馈

可点元素加 `Pressable`/`onPressIn/Out` 或 `opacity` 变化（RN 无 `:active` 伪类，禁依赖 CSS 伪类做交互态）。
