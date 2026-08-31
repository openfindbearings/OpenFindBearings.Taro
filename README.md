# OpenFindBearings.Taro

移动端前端应用，基于 Taro 4.x 构建，支持 H5、微信小程序、未来可扩展到 App。

## 技术栈

- Taro 4.x + React 18 + TypeScript
- NutUI（Taro 版组件库）
- Zustand（状态管理）
- SCSS + BEM 命名

## 功能模块

### Tab 1：首页
- 轴承搜索（型号、品牌、类型）
- 热门轴承推荐
- 推荐商家列表
- 轴承详情（技术参数、在售商家、替代品）

### Tab 2：入驻/商家
- 未登录 → 登录提示
- 已登录未入驻 → 入驻申请表单
- 审核中 → 状态展示
- 已入驻 → 店铺管理、在售商品、员工管理

### Tab 3：我的
- 用户资料、登录/注册
- 收藏轴承、关注商家、浏览历史
- 设置

## 构建与运行

```bash
cd OpenFindBearings.Taro

# 安装依赖
pnpm install

# H5 开发
pnpm run dev:h5

# 微信小程序开发
pnpm run dev:weapp

# H5 生产构建
pnpm run build:h5
```

## 部署

H5 构建产物由 Mobile BFF 托管，无需独立部署。

```bash
# 构建后产物在 dist/ 目录
pnpm run build:h5
```
