import { request } from './request'

/** 商家入驻申请参数 */
export interface ApplyMerchantParams {
  contactName: string
  phone: string
  description?: string
  licenseUrl?: string
}

/** 申请入驻（BFF /mobile/merchants/apply） */
export async function applyMerchant(params: ApplyMerchantParams): Promise<void> {
  // TODO: Implement when BFF supports merchant application
  throw new Error('商家入驻申请功能暂未实现')
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
    // TODO: Implement when BFF supports merchant profile
    // Currently, we can only get user profile via /mobile/profile
    return null
  } catch {
    return null
  }
}

/** 更新店铺信息 */
export async function updateMerchantProfile(data: { name?: string; contact?: string; phone?: string; description?: string }): Promise<void> {
  // TODO: Implement when BFF supports merchant profile update
  throw new Error('商家信息更新功能暂未实现')
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
  // TODO: Implement when BFF supports merchant bearings
  return { items: [], totalCount: 0 }
}

/** 添加在售商品 */
export async function addMyBearing(bearingId: string, price?: string): Promise<void> {
  // TODO: Implement when BFF supports merchant bearings
  throw new Error('添加在售商品功能暂未实现')
}

/** 移除在售商品 */
export async function removeMyBearing(bearingId: string): Promise<void> {
  // TODO: Implement when BFF supports merchant bearings
  throw new Error('移除在售商品功能暂未实现')
}

/** 员工管理 */
export interface StaffMember {
  userId: string
  userName: string
  role: string
}

export async function getStaffList(): Promise<StaffMember[]> {
  // TODO: Implement when BFF supports staff management
  return []
}

export async function inviteStaff(userName: string): Promise<void> {
  // TODO: Implement when BFF supports staff management
  throw new Error('邀请员工功能暂未实现')
}

export async function removeStaff(userId: string): Promise<void> {
  // TODO: Implement when BFF supports staff management
  throw new Error('移除员工功能暂未实现')
}
