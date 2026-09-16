// 商家服务：搜索、详情、在售轴承、入驻申请与状态（入驻需登录，走 BFF 代理）
import Taro from '@tarojs/taro'
import { request, getToken } from './request'
import { API, buildQuery, getBaseUrl } from './config'
import { getCurrentMerchantId } from './merchantContext'
import type { Paged } from './bearing'

/** 搜索结果项（对齐 BFF MerchantItem） */
export interface Merchant {
  id: string
  name: string
  companyName?: string | null
  type?: string | null
  isVerified: boolean
  status?: string | null
  productCount?: number | null
  logoUrl?: string | null
}

/** 商家详情（对齐 BFF MerchantDetail） */
export interface MerchantDetail {
  id: string
  name: string
  companyName?: string | null
  type?: string | null
  contactPerson?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
  address?: string | null
  isVerified: boolean
  status?: string | null
  grade?: string | null
  followerCount: number
  productCount: number
  logoUrl?: string | null
}

/** 商家在售轴承项（对齐 BFF MerchantBearingItem） */
export interface MerchantBearing {
  bearingId: string
  bearingPartNumber: string
  oldNumber?: string | null
  bearingTypeName?: string | null
  brandName?: string | null
  innerDiameter?: number | null
  outerDiameter?: number | null
  width?: number | null
  price?: string | null
  isOnSale: boolean
}

/** 商户入驻状态项（对齐 BFF MerchantApplicationItem） */
export interface MerchantApplication {
  merchantId: string
  merchantName: string
  /** Pending 待审核 / Active 已生效 / Suspended 已拒绝 */
  status: string
  rejectReason?: string | null
  /** MerchantAdmin / MerchantStaff */
  role?: string
  isVerified: boolean
  /** 商户 Logo 相对/绝对 URL（改动说明：TabBar/切换器显示当前商户头像） */
  logoUrl?: string | null
}

/** 可认领爬虫商家项（对齐 BFF ClaimableMerchantItem） */
export interface ClaimableMerchant {
  id: string
  name: string
  companyName?: string | null
  type?: string
}

/** 入驻申请详情（对齐 BFF ApplicationDetailItem，v1.6.0 新增：被拒重提表单预填源） */
export interface ApplicationDetail {
  merchantId: string
  merchantName: string
  status: string
  rejectReason?: string | null
  /** self / claim / nomination / none（前端据此决定编辑页形态） */
  applicationMode: string
  role: string
  type: number
  companyName?: string | null
  unifiedSocialCreditCode?: string | null
  contactPerson?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
  address?: string | null
  description?: string | null
  logoUrl?: string | null
}

/** 入驻申请请求体（对齐 BFF ApplyRequest） */
export interface ApplyMerchantBody {
  mode?: 'self' | 'claim'
  claimMerchantId?: string
  name?: string
  type?: number
  contactPerson?: string
  phone?: string
  mobile?: string
  email?: string
  address?: string
  companyName?: string
  unifiedSocialCreditCode?: string
  description?: string
  licenseUrl?: string
}

/** 提名他人为管理员请求体（对齐 BFF NominateRequest） */
export interface NominateMerchantBody {
  nomineePhone?: string
  nomineeEmail?: string
  name?: string
  type?: number
  companyName?: string
  contactPerson?: string
  phone?: string
  mobile?: string
  email?: string
  address?: string
  initiatorJoins?: boolean
  // 改动说明：可选目标商家ID。为空=提名新建（后端建 Draft）；
  //   非空=提名认领某个已存在的未认证无主商家（后端不新建、成员审核通过时建）
  targetMerchantId?: string
}

/** 接受提名请求体（对齐 BFF AcceptNominationRequest） */
export interface AcceptNominationBody {
  contactPerson?: string
  phone?: string
  mobile?: string
  email?: string
  address?: string
  companyName?: string
  unifiedSocialCreditCode?: string
  description?: string
  licenseUrl?: string
}

/** 商户成员项（对齐 BFF MerchantStaffItem） */
export interface MerchantStaff {
  id: string
  nickname: string
  avatar?: string | null
  role?: string | null
  /** Active / Suspended */
  status: string
}

/** 搜索商家 */
export function searchMerchants(params: { keyword?: string; verifiedOnly?: boolean; sortBy?: 'name' | 'productcount'; sortOrder?: 'asc' | 'desc'; page?: number; pageSize?: number }) {
  const qs = buildQuery({
    keyword: params.keyword,
    verifiedOnly: params.verifiedOnly == null ? undefined : String(params.verifiedOnly),
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20
  })
  return request<Paged<Merchant>>(`${API.MERCHANTS_SEARCH}?${qs}`, { auth: false })
}

/** 商家详情 */
export function getMerchantDetail(id: string) {
  return request<MerchantDetail>(API.MERCHANT_DETAIL(id), { auth: false })
}

/** 商家在售轴承 */
export function getMerchantBearings(id: string) {
  return request<Paged<MerchantBearing>>(`${API.MERCHANT_BEARINGS(id)}?page=1&pageSize=20`, { auth: false })
}

/** 提交入驻申请（self 新建 / claim 认领） */
export function applyMerchant(body: ApplyMerchantBody) {
  return request<{ merchantId: string; message?: string }>(API.MERCHANT_APPLY, { method: 'POST', data: body })
}

/** 查询当前用户在各商户的入驻状态 */
export function getMerchantApplication() {
  return request<MerchantApplication[]>(API.MERCHANT_APPLICATION)
}

/** 申请人自助撤回待审核的入驻申请（self 新建删店 / claim 认领退回公共池） */
export function withdrawApplication(merchantId: string) {
  return request<OpResult>(API.MERCHANT_WITHDRAW(merchantId), { method: 'POST' })
}

/** 查询入驻申请详情（被拒重提表单预填，v1.6.0 新增） */
export function getApplicationDetail(merchantId: string) {
  return request<ApplicationDetail>(API.MERCHANT_APPLICATION_DETAIL(merchantId))
}

/** 被拒后修改资料重新提交（v1.6.0 新增，字段同申请、不带 mode/claimMerchantId） */
export function resubmitApplication(merchantId: string, body: Omit<ApplyMerchantBody, 'mode' | 'claimMerchantId'>) {
  return request<{ merchantId: string; message?: string }>(API.MERCHANT_RESUBMIT(merchantId), { method: 'POST', data: body })
}

/** 删除被驳回的入驻申请（v1.6.0 新增，self 硬删 / claim 退回公共池） */
export function deleteApplication(merchantId: string) {
  return request<OpResult>(API.MERCHANT_DELETE_APPLICATION(merchantId), { method: 'POST' })
}

/** 认领搜索爬虫商家 */
export function searchClaimableMerchants(params: { keyword?: string; page?: number; pageSize?: number }) {
  const qs = buildQuery({
    keyword: params.keyword,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20
  })
  return request<Paged<ClaimableMerchant>>(`${API.MERCHANT_CLAIMABLE}?${qs}`)
}

/** 提名他人为管理员（入驻模式 B） */
export function nominateMerchant(body: NominateMerchantBody) {
  return request<{ code: string; message?: string }>(API.MERCHANT_NOMINATE, { method: 'POST', data: body })
}

/** 接受管理员提名（被提名人补资料并提交审核） */
export function acceptNomination(code: string, body: AcceptNominationBody) {
  return request<{ merchantId: string; message?: string }>(API.MERCHANT_NOMINATE_ACCEPT(code), { method: 'POST', data: body })
}

/** 待我接受的提名项（对齐 BFF PendingNominationItem） */
export interface PendingNomination {
  invitationCode: string
  merchantId: string
  merchantName: string
  companyName?: string | null
  createdAt: string
}

/** 查询待我接受的管理员提名（API 按 JWT 手机号匹配） */
export function getPendingNominations() {
  return request<PendingNomination[]>(API.MERCHANT_NOMINATIONS_PENDING)
}

/** 获取当前商户成员列表 */
export function getMerchantStaff() {
  return request<{ items: MerchantStaff[]; totalCount: number }>(`${API.MERCHANT_STAFF}?page=1&pageSize=100`)
}

/** 停用成员（管理员） */
export function suspendMerchantMember(userId: string) {
  return request<OpResult>(API.MERCHANT_MEMBER_SUSPEND(userId), { method: 'POST' })
}

/** 恢复成员（管理员） */
export function activateMerchantMember(userId: string) {
  return request<OpResult>(API.MERCHANT_MEMBER_ACTIVATE(userId), { method: 'POST' })
}

/** 变更成员角色（管理员） */
export function changeMerchantMemberRole(userId: string, role: string) {
  return request<OpResult>(API.MERCHANT_MEMBER_ROLE(userId), { method: 'PUT', data: { role } })
}

/** 自家在售商品项（对齐 BFF MyMerchantBearingItem） */
export interface MerchantBearingItem {
  bearingId: string
  bearingPartNumber: string
  oldNumber?: string | null
  bearingTypeName?: string | null
  brandName?: string | null
  innerDiameter?: number | null
  outerDiameter?: number | null
  width?: number | null
  price?: string | null
  isOnSale: boolean
}

/** 获取自家在售商品列表 */
export function getMyBearings(params: { page?: number; pageSize?: number; onlyOnSale?: boolean; pendingOnly?: boolean }) {
  const qs = buildQuery({
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    onlyOnSale: params.onlyOnSale == null ? undefined : String(params.onlyOnSale),
    pendingOnly: params.pendingOnly == null ? undefined : String(params.pendingOnly)
  })
  return request<Paged<MerchantBearingItem>>(`${API.MERCHANT_BEARINGS_MINE}?${qs}`)
}

/** 添加在售商品 */
export function createMyBearing(body: { bearingPartNumber: string; price?: string; stock?: string; minOrder?: string; remarks?: string }) {
  return request<{ id: string; message?: string }>(API.MERCHANT_BEARINGS_MINE, { method: 'POST', data: body })
}

/** 上架在售商品 */
export function putOnShelf(bearingId: string) {
  return request<OpResult>(API.MERCHANT_BEARING_ON_SHELF(bearingId), { method: 'POST' })
}

/** 下架在售商品 */
export function takeOffShelf(bearingId: string) {
  return request<OpResult>(API.MERCHANT_BEARING_OFF_SHELF(bearingId), { method: 'POST' })
}

/** 选择图片并上传营业执照（店铺认证；后端建/更新 LicenseVerification 等待 Admin 审核） */
export function uploadLicense(): Promise<OpResult> {
  return Taro.chooseImage({ count: 1, sizeType: ['compressed'] }).then((choose) => {
    const token = getToken()
    const path = choose.tempFilePaths[0]
    return new Promise<OpResult>((resolve, reject) => {
      Taro.uploadFile({
        url: `${getBaseUrl()}${API.MERCHANT_LICENSE}`,
        filePath: path,
        name: 'file',
        // 改动说明 G3：执照随当前商户上下文提交
        header: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(getCurrentMerchantId() ? { 'X-Merchant-Id': getCurrentMerchantId() as string } : {})
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, message: '营业执照已提交，等待审核' })
          } else {
            resolve({ success: false, message: `提交失败（${res.statusCode}）` })
          }
        },
        fail: (err) => reject(err)
      })
    })
  })
}

/** 上传 Excel 批量导入在售商品（仅商户管理员，multipart 走 BFF 代理到 API 再到 Sync） */
export function importInventory(filePath: string): Promise<OpResult> {
  const token = getToken()
  return new Promise((resolve, reject) => {
    Taro.uploadFile({
      url: `${getBaseUrl()}${API.MERCHANT_INVENTORY_IMPORT}`,
      filePath,
      name: 'file',
      // 修复 B5：文件上传旁路同样要带商户上下文头（导入目标是当前选中商户）
      header: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(getCurrentMerchantId() ? { 'X-Merchant-Id': getCurrentMerchantId() as string } : {})
      },
      success: (res) => {
        if (res.statusCode !== 200) {
          resolve({ success: false, message: `上传失败（${res.statusCode}）` })
          return
        }
        try {
          const d = JSON.parse(res.data)
          const data = d?.data ?? d
          resolve({
            success: true,
            message: `导入完成：共 ${data?.totalRows ?? '-'} 行，成功 ${data?.succeeded ?? '-'}，失败 ${data?.failed ?? '-'}`
          })
        } catch {
          resolve({ success: true, message: '导入处理完成' })
        }
      },
      fail: (err) => reject(err)
    })
  })
}

/** 商户资料（对齐 BFF MerchantProfile，供信息维护页编辑回填） */
export interface MerchantProfile {
  id: string
  name: string
  companyName?: string | null
  type?: string | null
  contactPerson?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
  address?: string | null
  logoUrl?: string | null
  website?: string | null
  unifiedSocialCreditCode?: string | null
  description?: string | null
  businessScope?: string | null
  isVerified: boolean
  status?: string | null
}

/** 更新商户资料请求体（null/undefined 字段后端保留原值；type 为数字枚举值） */
export interface UpdateMerchantProfileBody {
  name?: string
  companyName?: string
  englishName?: string
  unifiedSocialCreditCode?: string
  type?: number
  description?: string
  businessScope?: string
  logoUrl?: string
  website?: string
  contactPerson?: string
  phone?: string
  mobile?: string
  email?: string
  address?: string
}

/** 读取当前商户资料（维护页初始化，走 X-Merchant-Id 上下文） */
export function getMerchantProfile() {
  return request<MerchantProfile>(API.MERCHANT_PROFILE)
}

/** 更新当前商户资料（需商户管理员） */
export function updateMerchantProfile(body: UpdateMerchantProfileBody) {
  return request<OpResult>(API.MERCHANT_PROFILE, { method: 'PUT', data: body })
}

/**
 * 选择图片并上传商户 Logo：返回可访问绝对 URL（不直接落库，保存资料时随 profile.logoUrl 写入）。
 * 改动说明：仿 uploadLicense 的 multipart 旁路，带 X-Merchant-Id 当前商户上下文头。
 */
export function uploadMerchantLogo(): Promise<{ success: boolean; url?: string; message?: string }> {
  return Taro.chooseImage({ count: 1, sizeType: ['compressed'] }).then((choose) => {
    const token = getToken()
    const path = choose.tempFilePaths[0]
    return new Promise<{ success: boolean; url?: string; message?: string }>((resolve, reject) => {
      Taro.uploadFile({
        url: `${getBaseUrl()}${API.MERCHANT_LOGO}`,
        filePath: path,
        name: 'file',
        header: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(getCurrentMerchantId() ? { 'X-Merchant-Id': getCurrentMerchantId() as string } : {})
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const d = JSON.parse(res.data)
              const url = d?.url ?? d?.data?.url
              if (url) resolve({ success: true, url })
              else resolve({ success: false, message: d?.message || '上传失败' })
            } catch {
              resolve({ success: false, message: '上传响应解析失败' })
            }
          } else {
            resolve({ success: false, message: `上传失败（${res.statusCode}）` })
          }
        },
        fail: (err) => reject(err)
      })
    })
  })
}
