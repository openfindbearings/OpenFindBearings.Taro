# OpenFindBearings.Taro

移动端 H5 前端，基于 Taro 3.6.40 + React 18 + TypeScript 构建，一套代码编译到 H5（浏览器）、微信小程序、Android/iOS 原生 APP（React Native）。

## 技术栈

- Taro 3.6.40 + React 18 + TypeScript
- NutUI (React 版) UI 组件库
- lucide-react-taro 图标库（1500+ 图标，tree-shaking）
- Zustand 状态管理
- Sass 样式预处理器

## 架构

Taro H5 前端独立部署，通过 BFF访问后端服务。

```
Taro H5 → Mobile BFF → API + Identity
```

## 功能特性

| Tab | 功能 | 说明 |
|-----|------|------|
| 首页 | 轴承/商家搜索 | 核心查询功能，无需登录 |
| 入驻/商家 | 商家入驻申请/管理 | 商家行为（需入驻后） |
| 我的 | 个人中心 | 收藏/关注/历史（需登录） |

## 相关文档

### 设计文档

- [Taro 移动端设计](./doc/OpenFindBearings.Taro移动端设计-v1.2.0.md)

### 架构与规范

- [架构设计](./doc/01-架构设计/Taro架构设计-v1.0.0.md) — 现行架构总览：技术栈/分层/度量/主题/UI/认证/页面/跨端约束
- [界面设计规范](./doc/02-界面设计规范/界面设计规范-v1.3.0.md) — 色彩/运行时主题(深浅×预设)/字号/组件/页面布局
- [API 对接说明](./doc/03-API对接说明/API对接说明-v1.1.0.md) — 前端调用 BFF 的完整接口清单、请求/响应结构
- [UI 组件规范](./doc/04-UI组件规范/UI组件规范-v1.1.0.md) — 图标抽象层、公共组件、样式变量
- [跨端适配说明](./doc/05-跨端适配说明/跨端适配说明-v1.2.0.md) — 三阶段路线、RN 度量/存储/安全区/图标适配
- [设置入库与合规待办](./doc/06-待办与合规/设置入库与合规待办-v1.0.0.md) — 账号/合规类设置进库设计（随登录实现，待完成）

> 历史版本（重构方案 v0.1.0~v1.7.0、各专项文档旧版、移动端设计）归档于 `doc/archive/`。

### 关联项目

- [Mobile BFF 设计](../OpenFindBearings.Mobile/doc/OpenFindBearings.Mobile-BFF设计-v1.0.0.md)
