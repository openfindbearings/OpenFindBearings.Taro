// 商家服务：搜索、详情、在售轴承、入驻申请与状态（入驻需登录，走 BFF 代理）
import { request, getToken } from './request'
import { API, buildQuery, getBaseUrl } from './config'
import { getCurrentMerchantId } from './merchantContext'
import { uploadFileNormalized } from './upload'
import { pickImagePath } from './pickImage'
import type { Paged } from './bearing'
// 改动说明（v1.7.2）：本文件十余处返回类型引用 OpResult 但从未 import（定义在 user.ts），
//   Metro 不做类型检查所以运行时未爆雷，tsc --noEmit 报 Cannot find name——补 import 消掉
import type { OpResult } from './user'

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
  /** 已主动申请认证（v1.7.3：商户卡"申请认证"按钮态，Admin 认证后清除） */
  verifyRequested?: boolean
  /** 商户 Logo 相对/绝对 URL（改动说明：TabBar/切换器显示当前商户头像） */
  logoUrl?: string | null
}

/** 入驻发现搜索项（对齐 BFF ClaimableMerchantItem；v1.7.4 全量匹配 + 认领可行性标记）
 *  改动说明：三个标记字段仅搜索结果列表消费；认领流程手工构造"选中商户"时可省略，故设为可选 */
export interface ClaimableMerchant {
  id: string
  name: string
  companyName?: string | null
  type?: string
  /** 可认领（未认证+无在职成员+无提名锁定） */
  isClaimable?: boolean
  /** 当前用户已是该商户在职成员（去管理入口） */
  isMine?: boolean
  /** 状态文案：可认领 / 我的商户 / 已入驻 / 审核中 / 已认证 */
  statusText?: string
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
  /** 随单证照材料（v1.7.0：被拒重提页回显与"缺什么补什么"指引） */
  documents?: MerchantDocumentItem[] | null
}

/** 商户证照材料项（对齐 API PendingDocumentDto，1 执照 / 2 品牌授权书 / 3 厂房照） */
export interface MerchantDocumentItem {
  id: string
  merchantId: string
  merchantName?: string
  type: number
  typeName: string
  fileUrl: string
  /** Pending 待审核 / Approved 已通过 / Rejected 已拒绝 */
  status: string
  submitterName?: string
  submittedAt?: string
  reviewComment?: string | null
}

/** 随单材料提交项（对齐 BFF DocumentInput） */
export interface DocumentInput {
  type: number
  fileUrl: string
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
  /** v1.7.0 材料泛化：随单证照材料集合（原 licenseUrl 单字段废弃） */
  documents?: DocumentInput[]
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
  /** v1.7.0 材料泛化：接受提名补资料时随单提交（原 licenseUrl 单字段废弃） */
  documents?: DocumentInput[]
}

/** 商户成员项（对齐 BFF MerchantStaffItem） */
export interface MerchantStaff {
  id: string
  nickname: string
  avatar?: string | null
  role?: string | null
  /** 是否当前登录用户本人（v1.7.3：API 权威标记——登录态 id 是 Identity sub 与成员 id 不同源，前端无法自判） */
  isSelf: boolean
  /** Active / Suspended / Invited（v1.7.4 邀请确认制：待确认邀请行） */
  status: string
  /** 待确认邀请行的邀请ID（撤销用；成员行为 null） */
  invitationId?: string | null
  /** 手机号（v1.7.8 成员详情面板展示；列表行不显示，同商户成员互见） */
  mobile?: string | null
  /** 加入时间（成员行；邀请行为 null，详情面板展示） */
  joinedAt?: string | null
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

/** 商户申请认证（v1.7.3，管理员）：材料不齐时后端 400 透传缺项引导文案 */
export function requestVerifyMerchant(merchantId: string) {
  return request<OpResult>(API.MERCHANT_VERIFY_REQUEST(merchantId), { method: 'POST' })
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

/** 移除成员（管理员，v1.7.3：成员操作面板"移除"动作，比停用更彻底） */
export function removeMerchantMember(userId: string) {
  return request<OpResult>(API.MERCHANT_MEMBER_REMOVE(userId), { method: 'DELETE' })
}

/** 添加成员（v1.7.4 邀请确认制）：手机号/邮箱二选一，已注册用户转为待确认邀请（message 透传后端文案） */
export function addMerchantMember(body: { phone?: string; email?: string; role: string }) {
  return request<OpResult>(API.MERCHANT_STAFF, { method: 'POST', data: body })
}

/** 待我确认的员工邀请项（对齐 BFF PendingStaffInvitationItem，v1.7.4） */
export interface PendingStaffInvitation {
  invitationId: string
  merchantId: string
  merchantName: string
  role: string
  invitedByName?: string | null
  createdAt: string
}

/** 待我确认的员工邀请列表（v1.7.4：商户页横幅消费，按登录手机号匹配） */
export function getPendingStaffInvitations() {
  return request<PendingStaffInvitation[]>(API.MERCHANT_STAFF_INVITATIONS_PENDING)
}

/** 接受员工邀请（v1.7.4：建成员行入伙） */
export function acceptStaffInvitation(invitationId: string) {
  return request<OpResult>(API.MERCHANT_STAFF_INVITATION_ACCEPT(invitationId), { method: 'POST' })
}

/** 拒绝员工邀请（v1.7.4） */
export function declineStaffInvitation(invitationId: string) {
  return request<OpResult>(API.MERCHANT_STAFF_INVITATION_DECLINE(invitationId), { method: 'POST' })
}

/** 撤销员工邀请（v1.7.4，管理员对"已邀请"行操作） */
export function revokeStaffInvitation(invitationId: string) {
  return request<OpResult>(API.MERCHANT_STAFF_INVITATION_REVOKE(invitationId), { method: 'POST' })
}

/** 停用成员（管理员） */export function suspendMerchantMember(userId: string) {
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
  /** 关联主键（v1.7.3：编辑/上下架 busy 态定位用，区别于 bearingId） */
  id: string
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
  /** v1.7.3 编辑回填与审核角标（对齐 BFF MyMerchantBearingItem 扩展字段） */
  priceDescription?: string | null
  stockDescription?: string | null
  minOrderDescription?: string | null
  remarks?: string | null
  isPendingApproval: boolean
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
/** 添加在售商品（v1.7.3 断链修复：改为选平台已有型号 bearingId + 四项市场描述，对齐 BFF/API 契约；
    原 bearingPartNumber/price/stock 字段名与后端完全对不上，提交必失败） */
export function createMyBearing(body: { bearingId: string; priceDescription?: string; stockDescription?: string; minOrderDescription?: string; remarks?: string }) {
  return request<{ id: string; message?: string }>(API.MERCHANT_BEARINGS_MINE, { method: 'POST', data: body })
}

/** 编辑在售商品（v1.7.3 新增：改价格/库存/起订量描述与备注，改后重新进审核） */
export function updateMyBearing(id: string, body: { priceDescription?: string; stockDescription?: string; minOrderDescription?: string; remarks?: string }) {
  return request<OpResult>(API.MERCHANT_BEARING_UPDATE(id), { method: 'PUT', data: body })
}

/** 上架在售商品 */
export function putOnShelf(bearingId: string) {
  return request<OpResult>(API.MERCHANT_BEARING_ON_SHELF(bearingId), { method: 'POST' })
}

/** 下架在售商品 */
export function takeOffShelf(bearingId: string) {
  return request<OpResult>(API.MERCHANT_BEARING_OFF_SHELF(bearingId), { method: 'POST' })
}

/** 带当前商户上下文头的上传请求头 */
function uploadHeaders(token: string | null): Record<string, string> {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(getCurrentMerchantId() ? { 'X-Merchant-Id': getCurrentMerchantId() as string } : {})
  }
}

/** 上传失败原因归一化：区分用户取消选图与网络/超时失败（RN 端两类都从 reject 冒出来，文案不能混）
 * 改动说明（临时诊断）：非取消类失败把原始错误一并带出，真机定位后收敛回友好文案 */
function uploadFailMessage(e: any): string {
  const msg = String((e && (e.errMsg || e.message)) || e || '')
  if (msg.toLowerCase().includes('cancel')) return '已取消'
  return `上传失败：${msg.slice(0, 120)}`
}

// 选择图片并按类型上传证照材料（v1.7.0 由"上传营业执照"泛化；建待审记录进 Admin 材料队列）
// 改动说明（v1.7.1）：选图改走 pickImagePath（RN 端 expo-image-picker，适配 Android 13 权限模型）
export async function submitDocument(type: number): Promise<OpResult> {
  try {
    const path = await pickImagePath()
    if (!path) return { success: false, message: '已取消' }
    const r = await uploadFileNormalized({
      url: `${getBaseUrl()}${API.MERCHANT_DOCUMENTS}`,
      filePath: path,
      // multipart 附带材料类型字段（1 执照 / 2 授权书 / 3 厂房照）
      formData: { type: String(type) },
      header: uploadHeaders(getToken())
    })
    return r.statusCode >= 200 && r.statusCode < 300
      ? { success: true, message: '材料已提交，等待审核' }
      : { success: false, message: r.statusCode ? `提交失败（${r.statusCode}）` : '提交失败（响应异常）' }
  } catch (e) {
    return { success: false, message: uploadFailMessage(e) }
  }
}

/** 当前商户证照材料列表（信息维护页"证照材料"区数据源，v1.7.0 新增） */
// 改动说明（v1.7.2 崩溃修复）：request 是普通函数没有 .get 方法——原 request.get(...)
//   运行时为 undefined，进信息维护页 useDidShow 一调即抛 "undefined is not a function"（RN 红屏根因）
export function getMyDocuments() {
  return request<MerchantDocumentItem[]>(API.MERCHANT_DOCUMENTS, { method: 'GET' })
}

/** 材料文件预上传（v1.7.0 新增）：入驻申请随单材料先传拿 URL，提交时并入 documents 数组 */
export async function uploadDocumentFile(): Promise<{ url?: string; message?: string }> {
  try {
    const path = await pickImagePath()
    if (!path) return { message: '已取消' }
    const r = await uploadFileNormalized({
      url: `${getBaseUrl()}${API.MERCHANT_DOCUMENTS}/upload`,
      filePath: path,
      header: uploadHeaders(getToken())
    })
    if (r.statusCode >= 200 && r.statusCode < 300) {
      try {
        const body = JSON.parse(r.data)
        return body?.success ? { url: body.url } : { message: body?.message || '上传失败' }
      } catch {
        return { message: '上传响应解析失败' }
      }
    }
    return { message: r.statusCode ? `上传失败（${r.statusCode}）` : '上传失败（响应异常）' }
  } catch (e) {
    return { message: uploadFailMessage(e) }
  }
}

/** 上传 Excel 批量导入在售商品（仅商户管理员，multipart 走 BFF 代理到 API 再到 Sync）
 *  改动说明（v1.7.7）：fileName/fileType 透传（H5 blob 无扩展名/RN content URI 场景携带真实文件名与 MIME） */
export async function importInventory(filePath: string, fileName?: string, fileType?: string): Promise<OpResult> {
  try {
    // Excel 链路最长（BFF→API→Sync），给 2 分钟超时
    const r = await uploadFileNormalized({
      url: `${getBaseUrl()}${API.MERCHANT_INVENTORY_IMPORT}`,
      filePath,
      fileName,
      fileType,
      timeout: 120000,
      header: uploadHeaders(getToken())
    })
    if (r.statusCode !== 200) {
      return { success: false, message: `上传失败（${r.statusCode || '响应异常'}）` }
    }
    try {
      const d = JSON.parse(r.data)
      const data = d?.data ?? d
      return {
        success: true,
        message: `导入完成：共 ${data?.totalRows ?? '-'} 行，成功 ${data?.succeeded ?? '-'}，失败 ${data?.failed ?? '-'}`
      }
    } catch {
      return { success: true, message: '导入处理完成' }
    }
  } catch (e) {
    return { success: false, message: uploadFailMessage(e) }
  }
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
 * 改动说明：仿 submitDocument 的 multipart 旁路，带 X-Merchant-Id 当前商户上下文头。
 */
export async function uploadMerchantLogo(): Promise<{ success: boolean; url?: string; message?: string }> {
  try {
    const path = await pickImagePath()
    if (!path) return { success: false, message: '已取消' }
    const r = await uploadFileNormalized({
      url: `${getBaseUrl()}${API.MERCHANT_LOGO}`,
      filePath: path,
      header: uploadHeaders(getToken())
    })
    if (r.statusCode >= 200 && r.statusCode < 300) {
      try {
        const d = JSON.parse(r.data)
        const url = d?.url ?? d?.data?.url
        if (url) return { success: true, url }
        return { success: false, message: d?.message || '上传失败' }
      } catch {
        return { success: false, message: '上传响应解析失败' }
      }
    }
    return { success: false, message: r.statusCode ? `上传失败（${r.statusCode}）` : '上传失败（响应异常）' }
  } catch (e) {
    return { success: false, message: uploadFailMessage(e) }
  }
}
