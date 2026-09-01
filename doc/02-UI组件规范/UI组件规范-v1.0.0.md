# Taro UI 组件规范 v1.0.0

## 概述

本文档定义 Taro 移动端的 UI 组件使用规范，包括图标库、组件选型、样式变量、响应式策略。

## 变更日志

### v1.0.0 (2026-09-01)

- 初始版本，图标规范、组件选型、样式体系。

## 图标体系

### lucide-react-taro

项目使用 `lucide-react-taro`（v1.5.2）作为图标库。

**安装**：`pnpm add lucide-react-taro`

**使用方式**：

```tsx
import { Search, Store, Heart } from 'lucide-react-taro'

// 基础用法
<Search size={20} color='#999' />

// 实心图标
<Heart size={24} filled />

// 在 EmptyState 组件中（传入组件引用）
<EmptyState text='暂无数据' icon={Search} />
```

**图标映射表**：

| 场景 | 图标名 | 用途 |
|------|--------|------|
| 搜索 | `Search` | 搜索框、搜索结果空状态 |
| 商家 | `Store` | 商家相关页面 |
| 商品 | `Package` | 在售商品空状态 |
| 收藏 | `Heart` | 收藏列表空状态 |
| 关注 | `Users` | 关注列表空状态 |
| 浏览记录 | `BookOpen` | 浏览记录空状态 |
| 等待 | `Clock` | 审核中状态 |
| 用户 | `User` | 用户头像占位 |
| 默认空状态 | `Inbox` | EmptyState 组件默认图标 |

**规范**：

- 图标颜色使用主题色或灰色（`#999`/`#ccc`），不使用花哨渐变
- 图标大小统一：列表图标 20px、卡片图标 24px、空状态 48-64px
- `strokeWidth` 统一使用 1.5（细线条风格）

### TabBar 图标

TabBar 使用静态 PNG 文件（Taro/小程序限制，不支持 SVG）：

| Tab | 未选中 | 选中 |
|-----|--------|------|
| 首页 | tab-home.png | tab-home-active.png |
| 入驻/商家 | tab-merchant.png | tab-merchant-active.png |
| 我的 | tab-profile.png | tab-profile-active.png |

## 组件选型

### 公共组件

| 组件 | 文件 | 说明 |
|------|------|------|
| EmptyState | `components/EmptyState.tsx` | 空状态占位，支持自定义图标和文本 |
| AuthGuard | `components/AuthGuard.tsx` | 登录守卫，未登录时弹窗引导登录 |
| PriceTag | `components/PriceTag.tsx` | 价格标签，支持议价标识 |
| MerchantBadge | `components/MerchantBadge.tsx` | 商家认证标识 |

### 第三方组件

项目当前未引入 NutUI，使用 Taro 内置组件 + 自定义组件。后续可根据需要引入 NutUI React 版本。

**Taro 内置组件**：

| 组件 | 用途 |
|------|------|
| `View` | 容器 |
| `Text` | 文本 |
| `Image` | 图片 |
| `Input` | 输入框 |
| `Textarea` | 多行输入 |
| `Button` | 按钮 |
| `ScrollView` | 滚动容器 |

## 样式体系

### 命名空间

所有样式使用 BEM 命名规范，以页面/组件名为前缀：

```scss
// 首页搜索栏
.search-bar { }
.search-bar__input { }
.search-bar__button { }
.search-bar--focused { }  // 状态修饰

// 轴承卡片
.bearing-card { }
.bearing-card__header { }
.bearing-card__model { }
.bearing-card__brand { }
```

### 主题色

```scss
// app.scss 全局变量
$primary-color: #1890ff;    // 主色（蓝色）
$success-color: #52c41a;    // 成功（绿色）
$warning-color: #faad14;    // 警告（黄色）
$danger-color: #ff4d4f;     // 危险（红色）
$text-color: #333;          // 主要文本
$text-secondary: #999;      // 次要文本
$border-color: #eee;        // 边框色
$bg-color: #f5f5f5;         // 背景色
```

### 响应式策略

H5 模式下支持响应式布局：

```scss
// 卡片列表：小屏单列，大屏双列
.card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.card-list__item {
  width: 100%;

  @media (min-width: 768px) {
    width: calc(50% - 6px);
  }
}
```

小程序端固定单列布局，不做响应式适配。

## 页面交互规范

### 加载状态

- 列表加载：显示"加载中..."文本
- 详情加载：显示骨架屏（LoadingState 组件）
- 按钮提交：按钮文字变为"提交中..."并禁用

### 空状态

使用 EmptyState 组件统一空状态展示：

```tsx
<EmptyState text='暂无收藏' icon={Heart} />
```

### Toast 提示

使用 Taro 原生 Toast：

```typescript
// 成功
Taro.showToast({ title: '保存成功', icon: 'success' })

// 失败
Taro.showToast({ title: '操作失败', icon: 'none' })

// 加载中
Taro.showLoading({ title: '加载中...', mask: true })
```

### 页面跳转

```typescript
// 导航到子页面
Taro.navigateTo({ url: `/pages/home/bearingDetail/index?id=${id}` })

// 切换 Tab
Taro.switchTab({ url: '/pages/profile/index' })
```
