# Taro API 对接说明 v1.1.0

## 概述

Taro 前端通过 Mobile BFF（`bff.515813.xyz/mobile/*`）访问后端 API，不直连 API 或 Identity。本文档说明前端调用 BFF 的接口清单、请求/响应结构、错误处理。

## 变更日志

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

## 接口清单（`src/services/{home,bearing,merchant}.ts`）

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

### 认证（`auth.ts`，登录功能待接入）

`POST /mobile/auth/{login,login-sms,send-code,refresh}`，请求体含 `deviceId`（本地随机 GUID，与刷新一致）。

### 用户资料（需登录）

`GET /mobile/profile`、`GET /mobile/favorites`、`GET /mobile/followed`。

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
