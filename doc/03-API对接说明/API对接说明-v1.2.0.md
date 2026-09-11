# Taro API 对接说明 v1.2.0

## 概述

Taro 前端通过 Mobile BFF（`bff.515813.xyz/mobile/*`）访问后端 API，不直连 API 或 Identity。本文档说明前端调用 BFF 的接口清单、请求/响应结构、错误处理。

## 变更日志

### v1.2.0 (2026-09-11)

- 新增个人业务服务层 `user.ts`：收藏、关注、浏览历史、资料编辑、头像上传全部接口。
- 新增 `config.ts` 常量：`API` 对象统一管理所有端点路径（30+ 常量），`PRESET_AVATARS` 预置头像数组。
- 新增 `usableImage` 升级：相对路径自动走 BFF 媒体代理 `/mobile/media/**` 转发。
- 新增 `ProfileInfo` 聚合资料接口：Identity 账号信息 + API 业务资料（收藏/关注计数、商家绑定）。
- 新增收藏/关注 toggle + check 接口：详情页红心/关注按钮状态回显与切换。
- 新增浏览历史：轴承/商家分页查询、上报浏览、删除单条、清空全部。
- 新增资料编辑：昵称/头像/职业/公司/行业部分更新（BFF 双写 Identity + 业务库）。
- 新增头像上传：`Taro.uploadFile` multipart 旁路，预置 6 张 + 相册选图。

### v1.1.0 (2026-09-08)

- 校正 `getBaseUrl`：实际用 `process.env.TARO_ENV`（编译期常量）分支，非 `Taro.getEnv()`；RN/小程序返回绝对地址 `https://bff.515813.xyz`，H5 返回 `''`（dev proxy）。
- 校正请求封装：实际导出的是 `request(url, { method, data, auth })`，公开请求传 `auth: false`（非 `requestPublic`）。
- 新增 `buildQuery`（手写 query，规避 Hermes 无 `URLSearchParams.set`）与 `usableImage`（仅绝对 http 地址才渲染图片）。
- 校正商家/首页商家字段（companyName/type/productCount/logoUrl，contact→contactPerson）。
- 校正用户资料路径：`/mobile/profile`、`/mobile/favorites`、`/mobile/followed`（非 `/mobile/profile/*`）。
- 校正分页结构：`PagedData` 实际无 `totalPages`（仅 items/totalCount/page/pageSize）。
- 新增：搜索页四类 Tab、轴承/商家详情页对接说明。

### v1.0.0 (2026-09-01)

- 初始版本。

## 基础配置

### 域名与前缀

```typescript
// src/services/config.ts
export const API_PREFIX = '/mobile'
const BFF_PROD_BASE = 'https://bff.515813.xyz'

export function getBaseUrl(): string {
  if (process.env.TARO_ENV === 'h5') return ''          // H5：相对路径 + dev proxy
  return process.env.TARO_APP_BFF_BASE_URL || BFF_PROD_BASE  // RN/小程序：绝对地址
}
```

> RN 真机/模拟器无 dev proxy，base 必须为绝对地址，否则相对路径请求报 `Network request failed`。

### 请求封装

```typescript
// src/services/request.ts
export async function request<T>(url: string, options?: {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
  auth?: boolean   // 默认 true；公开接口传 false
}): Promise<T>
```

- `auth: true` 且已登录时自动附加 `Authorization: Bearer {token}`。
- 返回体自动解 `ApiResponse.data`（BFF 统一 `{success,code,data,message}` 包装）。
- 401 时自动用 `refresh_token` 刷新并重放；失败清 token 抛 `UNAUTHORIZED`。

### 工具函数

```typescript
// src/services/config.ts
// Hermes(RN 0.70) 无 URLSearchParams.set，查询串手写
export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string
// 仅绝对 http(s) 地址返回，否则 ''（RN 加载相对图片会告警/破图）
export function usableImage(url?: string | null): string
```

### API 端点常量

```typescript
// src/services/config.ts
export const API = {
  // 认证
  LOGIN: '/mobile/auth/login',
  REGISTER: '/mobile/auth/register',
  REFRESH: '/mobile/auth/refresh',
  LOGIN_SMS: '/mobile/auth/login-sms',
  SEND_CODE: '/mobile/auth/send-code',
  LOGOUT: '/mobile/auth/logout',
  DELETION: '/mobile/auth/deletion',

  // 首页聚合
  HOME: '/mobile/home',

  // 轴承
  BEARINGS_SEARCH: '/mobile/bearings/search',
  BEARING_DETAIL: (id: string) => `/mobile/bearings/${id}`,
  BEARING_MERCHANTS: (id: string) => `/mobile/bearings/${id}/merchants`,
  BEARING_INTERCHANGES: (id: string) => `/mobile/bearings/${id}/interchanges`,

  // 商家
  MERCHANTS_SEARCH: '/mobile/merchants/search',
  MERCHANT_DETAIL: (id: string) => `/mobile/merchants/${id}`,
  MERCHANT_BEARINGS: (id: string) => `/mobile/merchants/${id}/bearings`,

  // 个人（读）
  PROFILE: '/mobile/profile',
  FAVORITES: '/mobile/favorites',
  FOLLOWED: '/mobile/followed',
  HISTORY: '/mobile/history',

  // 个人（写，BFF /mobile/me/* 代理到 API /api/me/*）
  FAVORITE_TOGGLE: (id: string) => `/mobile/me/favorites/${id}`,
  FAVORITE_CHECK: (id: string) => `/mobile/me/favorites/${id}/check`,
  FOLLOW_TOGGLE: (id: string) => `/mobile/me/follows/${id}`,
  FOLLOW_CHECK: (id: string) => `/mobile/me/follows/${id}/check`,
  HISTORY_BEARINGS: '/mobile/me/history/bearings',
  HISTORY_MERCHANTS: '/mobile/me/history/merchants',
  HISTORY_RECORD_BEARING: (id: string) => `/mobile/me/history/bearings/${id}`,
  HISTORY_RECORD_MERCHANT: (id: string) => `/mobile/me/history/merchants/${id}`,
  HISTORY_CLEAR: '/mobile/me/history/clear',
  PROFILE_UPDATE: '/mobile/me/profile',
  AVATAR_UPLOAD: '/mobile/me/avatar',

  // 配置
  CONFIG: '/mobile/config',
} as const
```

## 接口清单

### 首页 `home.ts`

`getHome()` → `GET /mobile/home`（auth:false），返回 `HomeData`：

| 字段 | 类型 | 说明 |
|------|------|------|
| hotBearings | HotBearing[] | 热门轴承（最多 10 条） |
| merchants | HomeMerchant[] | 已认证推荐商家（最多 6 条）：id/name/companyName/isVerified/productCount/logoUrl |
| brands | HomeRef[] | 品牌列表（id/name） |
| bearingTypes | HomeRef[] | 类型列表（id/name） |

首页渲染热门轴承（横向卡→轴承详情）与推荐商家（含 logo，→商家详情）。

### 轴承 `bearing.ts`

- `searchBearings({keyword?,brandName?,bearingType?,page?,pageSize?})` → `GET /mobile/bearings/search`，返回 `Paged<Bearing>`。
- `getBearingDetail(id)` → `GET /mobile/bearings/{id}`，返回 `BearingDetail`。
- `getBearingMerchants(id)` → `GET /mobile/bearings/{id}/merchants`，返回 `Paged<BearingMerchant>`（merchantId/merchantName/price/isOnSale）。
- `getBearingInterchanges(id)` → `GET /mobile/bearings/{id}/interchanges`，返回 `Interchange[]`（id/partNumber/brandName/bearingType/confidence）。

```typescript
interface Bearing { id; partNumber; oldNumber?; bearingType; innerDiameter; outerDiameter; width; brandName; image3DUrl?; image2DUrl? }
interface BearingDetail extends 上 + englishName?; weight?; brandCountry?; viewCount; favoriteCount
```

> 图片字段可能是相对路径 `/images/...`，用 `usableImage()` 过滤后再渲染。

### 商家 `merchant.ts`

- `searchMerchants({keyword?,verifiedOnly?,page?,pageSize?})` → `GET /mobile/merchants/search`，返回 `Paged<Merchant>`。
- `getMerchantDetail(id)` → `GET /mobile/merchants/{id}`，返回 `MerchantDetail`。
- `getMerchantBearings(id)` → `GET /mobile/merchants/{id}/bearings`，返回 `Paged<MerchantBearing>`。

```typescript
interface Merchant { id; name; companyName?; type?; isVerified; status?; productCount?; logoUrl? }
interface MerchantDetail { id; name; companyName?; type?; contactPerson?; phone?; mobile?; email?; address?; isVerified; status?; grade?; followerCount; productCount; logoUrl? }
interface MerchantBearing { bearingId; bearingPartNumber; oldNumber?; bearingTypeName?; brandName?; innerDiameter?; outerDiameter?; width?; price?; isOnSale }
```

### 搜索页（`pages/home/search.tsx`）

单关键字并发查四类，顶部 Tab：`轴承 / 商家 / 品牌 / 类型`。

- 轴承、商家走后端 `searchBearings`/`searchMerchants`；品牌、类型用 `getHome()` 全量列表前端 `includes` 过滤。
- 每个 Tab 标签显示命中数量（搜索完成后）；完成后自动切到命中数最多的 Tab（并列优先 轴承>商家>品牌>类型）。
- 并发取数用 `Promise.all` + `fetchWithRetry`（仅网络错误重试 2 次，4xx/429 不重试）；`reqId` 丢弃过期响应防连点覆盖；真失败显示"加载失败，请重试"。
- 结果点击：轴承→轴承详情；商家→商家详情；品牌/类型→以该名称为关键字再搜轴承。

### 详情页

- 轴承详情 `pages/home/bearingDetail`：参数 + 在售商家（→商家详情）+ 替代品（→轴承详情）；收藏/纠错登录门槛。
- 商家详情 `pages/merchant/merchantDetail`：logo + 联系信息（电话始终显示，无则"暂无"）+ 在售轴承（→轴承详情）；"入驻商家"标签（isVerified）；关注/纠错登录门槛。

### 认证（`auth.ts`）

`POST /mobile/auth/{login,register,login-sms,send-code,refresh,logout,deletion}`，请求体含 `deviceId`（本地随机 GUID，与刷新一致）。

### 个人业务（`user.ts`）

#### 资料查询

- `getProfile()` → `GET /mobile/profile`，返回 `ProfileInfo`。

```typescript
interface ProfileInfo {
  id: string; userName: string; phoneNumber: string;
  nickname?: string; avatar?: string; occupation?: number;
  companyName?: string; industry?: string;
  merchantId?: string; merchantName?: string;
  favoriteCount: number; followCount: number;
  isActive: boolean; createdAt: string; lastLoginAt: string;
}
```

#### 资料编辑

- `updateProfile(body)` → `PUT /mobile/me/profile`，请求体 `ProfileUpdateBody`。

```typescript
interface ProfileUpdateBody {
  nickname?: string; avatar?: string; occupation?: number;
  companyName?: string; industry?: string;
}
```

- 返回 `{ success: boolean; message?: string }`。
- BFF 双写：Identity（昵称/头像）+ 业务库（昵称/头像/职业/公司/行业）。

#### 头像上传

- `uploadAvatar(filePath)` → `POST /mobile/me/avatar`（multipart）。

```typescript
// 使用 Taro.uploadFile 旁路（不经 request 拦截器）
const token = await ensureAccessToken()
await Taro.uploadFile({
  url: `${getBaseUrl()}${API.AVATAR_UPLOAD}`,
  filePath,
  name: 'file',
  header: token ? { Authorization: `Bearer ${token}` } : {}
})
```

- 返回 `{ success: boolean; url?: string }`（url 为 BFF 媒体代理绝对地址）。
- 格式限制：jpg/png/webp，≤2MB。
- 预置头像：`PRESET_AVATARS` 数组（6 张 128x128 PNG，经 BFF 媒体代理访问）。

#### 收藏

- `getFavorites(page?, pageSize?)` → `GET /mobile/favorites?page=1&pageSize=20`，返回 `Paged<FavoriteItem>`。
- `toggleFavorite(bearingId, favorited)` → `POST /mobile/me/favorites/{id}`（收藏）或 `DELETE /mobile/me/favorites/{id}`（取消）。
- `checkFavorite(bearingId)` → `GET /mobile/me/favorites/{id}/check`，返回 `{ isFavorited: boolean }`。

```typescript
interface FavoriteItem {
  id: string; createdAt: string;
  bearing: { id: string; partNumber: string; brandName?: string; bearingType?: string };
}
```

#### 关注

- `getFollowedMerchants(page?, pageSize?)` → `GET /mobile/followed?page=1&pageSize=20`，返回 `Paged<FollowedItem>`。
- `toggleFollow(merchantId, followed)` → `POST /mobile/me/follows/{id}`（关注）或 `DELETE /mobile/me/follows/{id}`（取消）。
- `checkFollow(merchantId)` → `GET /mobile/me/follows/{id}/check`，返回 `{ isFollowed: boolean }`。

```typescript
interface FollowedItem {
  id: string; createdAt: string;
  merchant: { id: string; name: string; companyName?: string; isVerified: boolean };
}
```

#### 浏览历史

- `getBearingHistory(page?, pageSize?)` → `GET /mobile/me/history/bearings?page=1&pageSize=20`，返回 `Paged<BearingHistoryItem>`。
- `getMerchantHistory(page?, pageSize?)` → `GET /mobile/me/history/merchants?page=1&pageSize=20`，返回 `Paged<MerchantHistoryItem>`。
- `recordBearingView(bearingId)` → `POST /mobile/me/history/bearings/{id}`（fire-and-forget）。
- `recordMerchantView(merchantId)` → `POST /mobile/me/history/merchants/{id}`（fire-and-forget）。
- `deleteBearingHistory(bearingId)` → `DELETE /mobile/me/history/bearings/{id}`。
- `deleteMerchantHistory(merchantId)` → `DELETE /mobile/me/history/merchants/{id}`。
- `clearHistory()` → `DELETE /mobile/me/history/clear`。

```typescript
interface BearingHistoryItem {
  id: string; bearingId: string; bearingPartNumber: string;
  brandName?: string; viewedAt: string; viewCount: number;
}
interface MerchantHistoryItem {
  id: string; merchantId: string; merchantName: string;
  companyName?: string; viewedAt: string; viewCount: number;
}
```

## 错误处理

| 状态码 | 处理 |
|--------|------|
| 200 | 正常解析 `ApiResponse.data` |
| 401 | 刷新 token 重放，失败清 token |
| 404 | 空状态 |
| 429 | 限流（BFF→API 已内部豁免；前端不重试，提示重试） |
| 500/503 | "服务暂不可用" |

## 分页数据结构

```typescript
interface PagedData<T> { items: T[]; totalCount: number; page: number; pageSize: number }
```

> 实际无 `totalPages`，前端按 `Math.ceil(totalCount / pageSize)` 计算总页数。
