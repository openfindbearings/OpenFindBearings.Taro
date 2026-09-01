# Taro API 对接说明 v1.0.0

## 概述

Taro 前端通过 Mobile BFF（`bff.515813.xyz/mobile/*`）访问后端 API，不直连 API 或 Identity。本文档说明前端调用 BFF 的完整接口清单、请求/响应结构、错误处理。

## 变更日志

### v1.0.0 (2026-09-01)

- 初始版本，完整 API 对接说明。

## 基础配置

### 域名与前缀

```typescript
// src/services/request.ts
const API_PREFIX = '/mobile'

function getBaseUrl(): string {
  // H5：相对路径（同源）
  if (Taro.getEnv() === Taro.ENV_TYPE.WEB) return ''
  // 小程序/App：BFF 公网域名
  return process.env.TARO_APP_BFF_BASE_URL || 'https://bff.515813.xyz'
}
```

### 请求封装

所有请求通过 `request.ts` 统一处理：

```typescript
import { request, requestPublic } from './services/request'

// 公开请求（无需登录）
const data = await requestPublic<Bearing[]>('/mobile/bearings/search', { keyword: '6205' })

// 需登录请求（自动附加 JWT）
const profile = await request<UserProfile>({ url: '/mobile/profile', auth: true })
```

### 认证流程

1. 登录后获取 `access_token` + `refresh_token`
2. `access_token` 存内存（不持久化），`refresh_token` 存本地存储
3. 请求时自动附加 `Authorization: Bearer {token}`
4. 收到 401 时自动用 `refresh_token` 刷新，成功后重放原请求
5. 刷新失败时清除 token，提示重新登录

## 接口清单

### 首页

#### GET /mobile/home

获取首页聚合数据（热门轴承 + 推荐商家 + 品牌 + 类型）。

**调用方式**：

```typescript
// src/pages/home/index.tsx
const res = await requestPublic<{
  hotBearings: Bearing[]
  merchants: Merchant[]
  brands: Brand[]
  bearingTypes: BearingType[]
}>('/mobile/home')
```

**响应结构**：

| 字段 | 类型 | 说明 |
|------|------|------|
| hotBearings | Bearing[] | 热门轴承（最多 10 条） |
| merchants | Merchant[] | 已认证推荐商家（最多 6 条） |
| brands | Brand[] | 品牌列表 |
| bearingTypes | BearingType[] | 类型列表 |

### 轴承

#### GET /mobile/bearings/search

搜索轴承。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| keyword | string | 关键词（型号/品牌/旧代号） |
| brandName | string | 品牌名筛选 |
| bearingType | string | 类型名筛选 |
| page | number | 页码（默认 1） |
| pageSize | number | 每页条数（默认 20） |

**响应**：`PagedData<Bearing>`

```typescript
interface Bearing {
  id: string
  partNumber: string
  oldNumber?: string
  bearingType?: string
  brandName?: string
  innerDiameter?: number
  outerDiameter?: number
  width?: number
  image3dUrl?: string
  image2dUrl?: string
}
```

#### GET /mobile/bearings/{id}

获取轴承详情。

**响应**：`Bearing` 对象，额外包含 `englishName`、`weight`、`brandCountry`、`viewCount`、`favoriteCount`。

#### GET /mobile/bearings/{id}/merchants

获取轴承在售商家。

**参数**：`page`、`pageSize`

**响应**：`PagedData<BearingMerchant>`

```typescript
interface BearingMerchant {
  merchantId: string
  merchantName: string
  price?: string    // 价格描述文本
  isOnSale: boolean
}
```

#### GET /mobile/bearings/{id}/interchanges

获取轴承替代品。

**响应**：`InterchangeItem[]`

```typescript
interface InterchangeItem {
  id: string
  partNumber: string
  brandName: string
  bearingType: string
  confidence: number  // 可信度 0-100
}
```

### 商家

#### GET /mobile/merchants/search

搜索商家。

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| keyword | string | 商家名关键词 |
| verifiedOnly | boolean | 仅已认证商家 |
| page | number | 页码 |
| pageSize | number | 每页条数 |

**响应**：`PagedData<Merchant>`

```typescript
interface Merchant {
  id: string
  name: string
  description?: string
  isVerified: boolean
  status?: string
  bearingCount?: number
}
```

#### GET /mobile/merchants/{id}

获取商家详情。响应包含 `contact`、`phone` 等字段。

#### GET /mobile/merchants/{id}/bearings

获取商家在售商品。

**响应**：`PagedData<MerchantBearing>`

```typescript
interface MerchantBearing {
  bearingId: string
  bearingPartNumber: string
  oldNumber?: string
  bearingTypeName?: string
  brandName?: string
  innerDiameter?: number
  outerDiameter?: number
  width?: number
  price?: string
  isOnSale: boolean
}
```

### 认证

#### POST /mobile/auth/login

密码登录。

```typescript
const res = await requestPublic<{
  success: boolean
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  message?: string
}>('/mobile/auth/login', {
  username: '手机号',
  password: '密码',
  deviceId: getDeviceId(),  // 本地存储的随机 GUID
})
```

#### POST /mobile/auth/login-sms

短信登录/注册。

```typescript
const res = await requestPublic<LoginResponse>('/mobile/auth/login-sms', {
  phone: '手机号',
  code: '验证码',
  deviceId: getDeviceId(),
})
```

#### POST /mobile/auth/send-code

发送验证码。

```typescript
await requestPublic('/mobile/auth/send-code', { phone: '手机号' })
```

#### POST /mobile/auth/refresh

刷新令牌。

```typescript
const res = await requestPublic<LoginResponse>('/mobile/auth/refresh', {
  refreshToken: getRefreshToken(),
  deviceId: getDeviceId(),
})
```

### 用户资料（需登录）

#### GET /mobile/profile

获取当前用户资料。

#### GET /mobile/profile/favorites

获取收藏轴承列表。

#### GET /mobile/profile/follows

获取关注商家列表。

## 错误处理

### 统一错误处理

```typescript
// request.ts 中的 parseResponse
function parseResponse<T>(res: Taro.request.Response): T {
  if (res.statusCode >= 200 && res.statusCode < 300) {
    const body = res.data as ApiResponse<T>
    if (body && typeof body === 'object' && 'success' in body) {
      if (!body.success) throw new Error(body.message || '请求失败')
      return body.data as T
    }
    return res.data as T
  }
  throw new Error(`请求失败 (${res.statusCode})`)
}
```

### 错误码处理

| 状态码 | 处理 |
|--------|------|
| 200 | 正常解析 |
| 401 | 尝试刷新 token，失败跳登录 |
| 404 | 显示空状态 |
| 500/503 | 提示"服务暂不可用" |

### 网络异常

```typescript
try {
  const data = await searchBearings({ keyword: '6205' })
} catch (e) {
  Taro.showToast({ title: (e as Error).message || '网络异常', icon: 'none' })
}
```

## 分页数据结构

所有分页接口返回统一结构：

```typescript
interface PagedData<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}
```

前端分页组件基于此结构渲染页码导航。
