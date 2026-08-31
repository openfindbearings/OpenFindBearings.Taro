import { request } from './request'

/** 商家入驻申请参数 */
export interface ApplyMerchantParams {
  contactName: string
  phone: string
  description?: string
  licenseUrl?: string
}

/** 申请入驻（BFF /api/mobile/merchants/apply） */
export async function applyMerchant(params: ApplyMerchantParams): Promise<void> {
  await request({ url: '/api/mobile/merchants/apply', method: 'POST', data: params as Record<string, unknown> })
}

/** 获取我的商家信息 */
export interface MyMerchantProfile {
  id: string
  name: string
  status: string
  contact?: string
  phone?: string
  description?: string
  isVerified: boolean
}

export async function getMyMerchantProfile(): Promise<MyMerchantProfile | null> {
  try {
    return await request<MyMerchantProfile>({ url: '/api/mobile/profile' })
  } catch {
    return null
  }
}

/** 更新店铺信息 */
export async function updateMerchantProfile(data: { name?: string; contact?: string; phone?: string; description?: string }): Promise<void> {
  await request({ url: '/api/mobile/profile', method: 'PUT', data })
}

/** 在售商品管理 */
export interface MerchantBearingItem {
  id: string
  bearingPartNumber: string
  oldNumber?: string
  bearingTypeName?: string
  brandName?: string
  price?: string
  isOnSale: boolean
}

export async function getMyBearings(page = 1, pageSize = 20): Promise<{ items: MerchantBearingItem[]; totalCount: number }> {
  return request({ url: '/api/mobile/merchant/bearings', data: { page, pageSize } })
}

/** 添加在售商品 */
export async function addMyBearing(bearingId: string, price?: string): Promise<void> {
  await request({ url: '/api/mobile/merchant/bearings', method: 'POST', data: { bearingId, price } })
}

/** 移除在售商品 */
export async function removeMyBearing(bearingId: string): Promise<void> {
  await request({ url: `/api/mobile/merchant/bearings/${bearingId}`, method: 'DELETE' })
}

/** 员工管理 */
export interface StaffMember {
  userId: string
  userName: string
  role: string
}

export async function getStaffList(): Promise<StaffMember[]> {
  return request({ url: '/api/mobile/merchant/staff' })
}

export async function inviteStaff(userName: string): Promise<void> {
  await request({ url: '/api/mobile/merchant/staff', method: 'POST', data: { userName } })
}

export async function removeStaff(userId: string): Promise<void> {
  await request({ url: `/api/mobile/merchant/staff/${userId}`, method: 'DELETE' })
}
