// 预置头像本地资源：打进客户端包体，展示与选择不再依赖服务端下发/代理
import preset1 from '../assets/avatars/p1.png'
import preset2 from '../assets/avatars/p2.png'
import preset3 from '../assets/avatars/p3.png'
import preset4 from '../assets/avatars/p4.png'
import preset5 from '../assets/avatars/p5.png'
import preset6 from '../assets/avatars/p6.png'

/** BFF API 配置常量 */

/** API 路径前缀 */
export const API_PREFIX = '/mobile'

/**
 * 手写 query string 构造。
 * 改动说明：Hermes(RN 0.70) 的 URLSearchParams 未实现 .set/.toString，
 * 用它会抛 "URLSearchParams.set is not implemented"，故改用手写拼接 + encodeURIComponent。
 * 传入 key/value 对，跳过 null/undefined/'' 值。
 */
export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const parts: string[] = []
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === null || v === undefined || v === '') return
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  })
  return parts.join('&')
}

/** BFF 线上绝对地址（RN/小程序无 dev proxy，必须走公网 https） */
const BFF_PROD_BASE = 'https://<your-bff-domain>'

/**
 * 运行时媒体源 base 覆盖值：站点配置 /api/mobile/config 下发 Mobile.MediaBaseUrl 后写入。
 * 改动说明：媒体源换域名 / 切对象存储时，只改服务端这一配置即可全端跟随，无需发版；
 * 未加载到配置前为 null，getMediaBase 回落编译期默认（H5 同源 /media，RN 走公网）。
 */
let mediaBaseUrlOverride: string | null = null

/** 应用服务端下发的媒体 base（末尾斜杠会被去掉）；供启动引导在拉到站点配置后调用 */
export function setMediaBaseUrl(url?: string | null): void {
  const trimmed = (url || '').trim().replace(/\/+$/, '')
  mediaBaseUrlOverride = trimmed || null
}

/**
 * 按平台返回请求 base 地址。
 * 改动说明：原实现无条件返回 ''，仅适用于 H5 开发期 webpack proxy；
 * RN 真机/模拟器无 proxy，相对路径会触发 Network request failed，
 * 故 RN 与小程序返回 BFF 公网绝对地址。H5 仍返回 ''（dev proxy / 同源）。
 * 可用环境变量 TARO_APP_BFF_BASE_URL 覆盖（默认 https://<your-bff-domain>）。
 */
export function getBaseUrl(): string {
  const env = process.env.TARO_ENV
  if (env === 'h5') {
    return ''
  }
  return process.env.TARO_APP_BFF_BASE_URL || BFF_PROD_BASE
}

/**
 * 媒体资源公网 base（与业务 API 解耦的独立静态源）。
 * 改动说明：图片不再经 BFF /mobile/media 逐字节代理（应用不应代理二进制，反模式），
 * 改由独立 nginx 媒体服务在 /media 路径直出，Sync/API 各自的落盘目录只读挂载进去。
 * 将来切换对象存储（MinIO/OSS/CDN）只需改此 base（或站点配置下发的 MediaBaseUrl），
 * 库内相对键不变，故为"轻松切换"的唯一切换点。可用环境变量 TARO_APP_MEDIA_BASE_URL 覆盖。
 */
export function getMediaBase(): string {
  // 服务端下发优先（换域名/切对象存储免发版）；未下发时回落编译期默认
  if (mediaBaseUrlOverride) return mediaBaseUrlOverride
  const env = process.env.TARO_ENV
  if (env === 'h5') {
    // H5 同源 /media：线上由 bff 域名 ingress 把 /media 路由到媒体服务；开发由 devServer 代理
    return '/media'
  }
  // RN/小程序无同源概念，走公网绝对地址
  return `${process.env.TARO_APP_MEDIA_BASE_URL || BFF_PROD_BASE}/media`
}

/**
 * 预置头像：稳定相对键 -> 客户端本地图片资源的映射。
 * 改动说明：预置头像是纯客户端静态资源，打包进 app，不再从服务器取；
 * 库里只存稳定键（如 /avatars/presets/p1.png），展示时经 usableImage 映射回本地图。
 */
const PRESET_LOCAL_MAP: Record<string, string> = {
  '/avatars/presets/p1.png': preset1,
  '/avatars/presets/p2.png': preset2,
  '/avatars/presets/p3.png': preset3,
  '/avatars/presets/p4.png': preset4,
  '/avatars/presets/p5.png': preset5,
  '/avatars/presets/p6.png': preset6
}

/** 预置头像稳定键列表（入库用键，展示经 usableImage 解析到本地图） */
export const PRESET_AVATAR_KEYS: string[] = Object.keys(PRESET_LOCAL_MAP)

/**
 * 把库内图片地址解析为可渲染的 src。
 * 改动说明：库内统一只存相对媒体键（/images/...、/uploads/...、/avatars/... 预置键），
 * 由本函数拼当前媒体源 base；预置键直接映射到客户端本地图；绝对 http(s) 原样返回。
 * 兼容历史：老数据可能存的是绝对或 /mobile/media 前缀地址，先归一成相对键再解析，
 * 保证迁移不彻底时也不破图。
 */
export function usableImage(url?: string | null): string {
  if (!url) return ''
  // 历史绝对地址归一：剥离 scheme://host + /mobile/media 前缀，还原为相对媒体键
  let key = url
  const legacy = key.match(/^https?:\/\/[^/]+(\/.*)$/i)
  if (legacy) key = legacy[1]
  if (key.startsWith('/mobile/media/')) key = key.slice('/mobile/media'.length)
  // 预置头像：稳定键直接映射到客户端本地资源（本地 require 结果可能是数字 ID，按 any 透传）
  if (PRESET_LOCAL_MAP[key]) return PRESET_LOCAL_MAP[key]
  if (/^https?:\/\//i.test(key)) return key
  if (key.startsWith('/')) {
    const base = key.startsWith('/mobile/') ? getBaseUrl() : getMediaBase()
    return `${base}${key}`
  }
  return ''
}

/** API 路径 */
export const API = {
  /** 认证 */
  LOGIN: `${API_PREFIX}/auth/login`,
  // 改动说明（短信登录上线）：删除 REGISTER——注册页与 BFF /auth/register 已下线，
  // 注册统一走"验证码登录即注册"（LOGIN_SMS 对未注册手机号自动建号）
  REFRESH: `${API_PREFIX}/auth/refresh`,
  LOGIN_SMS: `${API_PREFIX}/auth/login-sms`,
  SEND_CODE: `${API_PREFIX}/auth/send-code`,
  LOGOUT: `${API_PREFIX}/auth/logout`,
  DELETION: `${API_PREFIX}/auth/deletion`,

  /** 首页聚合 */
  HOME: `${API_PREFIX}/home`,

  /** 品牌字典（v1.7.29 发现页寻货筛选面板数据源，轻量独立端点） */
  BRANDS: `${API_PREFIX}/brands`,

  /** 轴承 */
  BEARINGS_SEARCH: `${API_PREFIX}/bearings/search`,
  BEARING_DETAIL: (id: string) => `${API_PREFIX}/bearings/${id}`,
  BEARING_MERCHANTS: (id: string) => `${API_PREFIX}/bearings/${id}/merchants`,
  BEARING_INTERCHANGES: (id: string) => `${API_PREFIX}/bearings/${id}/interchanges`,

  /** 商家 */
  MERCHANTS_SEARCH: `${API_PREFIX}/merchants/search`,
  MERCHANT_DETAIL: (id: string) => `${API_PREFIX}/merchants/${id}`,
  MERCHANT_BEARINGS: (id: string) => `${API_PREFIX}/merchants/${id}/bearings`,
  /** 商户入驻（需登录） */
  MERCHANT_APPLY: `${API_PREFIX}/merchants/apply`,
  MERCHANT_APPLICATION: `${API_PREFIX}/merchants/application`,
  /** 申请人自助撤回待审核申请（self 新建删店 / claim 认领退回公共池） */
  MERCHANT_WITHDRAW: (id: string) => `${API_PREFIX}/merchants/${id}/withdraw`,
  /** 商户自助关店（v1.7.15）：认领商户退回公开信息池 / 自建商户直接删除 */
  MERCHANT_CLOSE: (id: string) => `${API_PREFIX}/merchants/${id}/close`,
  /** 入驻申请详情（被拒重提表单预填，v1.6.0 新增） */
  MERCHANT_APPLICATION_DETAIL: (id: string) => `${API_PREFIX}/merchants/${id}/application`,
  /** 被拒后修改资料重新提交（v1.6.0 新增） */
  MERCHANT_RESUBMIT: (id: string) => `${API_PREFIX}/merchants/${id}/resubmit`,
  /** 删除被驳回的入驻申请（v1.6.0 新增） */
  MERCHANT_DELETE_APPLICATION: (id: string) => `${API_PREFIX}/merchants/${id}/delete-application`,
  MERCHANT_CLAIMABLE: `${API_PREFIX}/merchants/claimable`,
  MERCHANT_NOMINATE: `${API_PREFIX}/merchants/nominate`,
  MERCHANT_NOMINATE_ACCEPT: (code: string) => `${API_PREFIX}/merchants/nominate/${code}/accept`,
  MERCHANT_NOMINATIONS_PENDING: `${API_PREFIX}/merchants/nominations/pending`,
  /** 商户成员管理（需登录且为商户成员） */
  MERCHANT_STAFF: `${API_PREFIX}/merchants/staff`,
  MERCHANT_MEMBER_REMOVE: (id: string) => `${API_PREFIX}/merchants/staff/${id}`,
  MERCHANT_VERIFY_REQUEST: (id: string) => `${API_PREFIX}/merchants/${id}/verify-request`,
  MERCHANT_MEMBER_SUSPEND: (id: string) => `${API_PREFIX}/merchants/members/${id}/suspend`,
  MERCHANT_MEMBER_ACTIVATE: (id: string) => `${API_PREFIX}/merchants/members/${id}/activate`,
  MERCHANT_MEMBER_ROLE: (id: string) => `${API_PREFIX}/merchants/members/${id}/role`,
  /** 员工邀请确认制（v1.7.4）：待我确认列表 + 接受/拒绝/撤销 */
  MERCHANT_STAFF_INVITATIONS_PENDING: `${API_PREFIX}/merchants/staff/invitations/pending`,
  MERCHANT_STAFF_INVITATION_ACCEPT: (id: string) => `${API_PREFIX}/merchants/staff/invitations/${id}/accept`,
  MERCHANT_STAFF_INVITATION_DECLINE: (id: string) => `${API_PREFIX}/merchants/staff/invitations/${id}/decline`,
  MERCHANT_STAFF_INVITATION_REVOKE: (id: string) => `${API_PREFIX}/merchants/staff/invitations/${id}/revoke`,
  /** 商户商品管理（需登录且为商户成员） */
  MERCHANT_BEARINGS_MINE: `${API_PREFIX}/merchant/bearings`,
  MERCHANT_BEARING_UPDATE: (id: string) => `${API_PREFIX}/merchant/bearings/${id}`,
  MERCHANT_BEARING_ON_SHELF: (id: string) => `${API_PREFIX}/merchant/bearings/${id}/onshelf`,
  MERCHANT_BEARING_OFF_SHELF: (id: string) => `${API_PREFIX}/merchant/bearings/${id}/offshelf`,
  // v1.7.21 三态销售状态：置为补货中（eta 走 query）
  MERCHANT_BEARING_RESTOCK: (id: string) => `${API_PREFIX}/merchant/bearings/${id}/restock`,
  /** 营业执照上传（店铺认证） */
  // v1.7.0 材料泛化：执照单轨升级为证照材料多类型（GET 列表 / POST 上传带 type）
  MERCHANT_DOCUMENTS: `${API_PREFIX}/merchant/documents`,
  /** 商户信息维护（需商户管理员）：读当前商户资料 / 写资料 / 上传 Logo */
  MERCHANT_PROFILE: `${API_PREFIX}/merchant/profile`,
  MERCHANT_LOGO: `${API_PREFIX}/merchant/logo`,

  // 改动说明：站内信（消息中心列表/未读数/已读标记），代理 BFF /mobile/notifications/*
  NOTIFICATIONS: `${API_PREFIX}/notifications`,
  NOTIFICATIONS_UNREAD_COUNT: `${API_PREFIX}/notifications/unread-count`,
  /** v2.12.0 列表多选：批量已读/批量删除 */
  NOTIFICATIONS_BATCH_READ: `${API_PREFIX}/notifications/batch-read`,
  NOTIFICATIONS_BATCH_DELETE: `${API_PREFIX}/notifications/batch-delete`,
NOTIFICATION_READ: (id: string) => `${API_PREFIX}/notifications/${id}/read`,
NOTIFICATIONS_READ_ALL: `${API_PREFIX}/notifications/read-all`,
// 改动说明（v1.7.9）：消息删除两路径（单条左滑删除 / 清空已读批量出口）
NOTIFICATION_ITEM: (id: string) => `${API_PREFIX}/notifications/${id}`,
NOTIFICATIONS_CLEAR_READ: `${API_PREFIX}/notifications/read`,

  // 改动说明（v1.7.17 积分底座）：账户/签到/流水三路径，代理 BFF /mobile/points/*
  POINTS_ACCOUNT: `${API_PREFIX}/points/account`,
  POINTS_CHECKIN: `${API_PREFIX}/points/checkin`,
  POINTS_TRANSACTIONS: `${API_PREFIX}/points/transactions`,
  // v1.7.18 任务中心：赚分任务清单（规则+完成态，daily 任务每日自动刷新）
  POINTS_TASKS: `${API_PREFIX}/points/tasks`,
  // v2.5.0 商家经济：商家福利卡（最佳商家等级/buff 清单/升级提示）
  POINTS_MERCHANT_BUFF: `${API_PREFIX}/points/merchant-buff`,
  // v2.6.0 M3：商家集体任务板 + 商家实力月榜（代理 BFF /mobile/points/merchant-tasks|ranking）
  POINTS_MERCHANT_TASKS: `${API_PREFIX}/points/merchant-tasks`,
  POINTS_MERCHANT_RANKING: `${API_PREFIX}/points/merchant-ranking`,
  // v2.13.0 等级玩法：段位阶梯表 + 商家等级详情（代理 BFF /mobile/points/levels|merchant-grade）
  POINTS_LEVELS: `${API_PREFIX}/points/levels`,
  POINTS_MERCHANT_GRADE: `${API_PREFIX}/points/merchant-grade`,
  // 游戏中心（v2.10.1 插件架构）：通用端点组，按游戏 key 路由
  GAMES: `${API_PREFIX}/games`,
  // v2.1.0 成就子系统：成就墙/我的徽章排/商户徽章排，走 BFF /mobile/achievements/*
  ACHIEVEMENTS_WALL: `${API_PREFIX}/achievements/wall`,
  ACHIEVEMENTS_ME: `${API_PREFIX}/achievements/me`,
  ACHIEVEMENTS_MERCHANT: (id: string) => `${API_PREFIX}/achievements/merchants/${id}`,
  // v2.8.0 称号系统：我的称号列表/佩戴（代理 BFF /mobile/achievements/titles|title）
  ACHIEVEMENTS_TITLES: `${API_PREFIX}/achievements/titles`,
  ACHIEVEMENTS_TITLE: `${API_PREFIX}/achievements/title`,
  // v2.3.0 商城虚拟权益：目录/兑换/我的订单，走 BFF /mobile/mall/*
  MALL_ITEMS: `${API_PREFIX}/mall/items`,
  MALL_REDEEM: `${API_PREFIX}/mall/redeem`,
  MALL_ORDERS: `${API_PREFIX}/mall/orders`,
  // v2.4.0 商家经济：礼品兑换/收货 + 商家金库/挂礼/礼品订单
  MALL_REDEEM_GIFT: `${API_PREFIX}/mall/redeem-gift`,
  MALL_CONFIRM_RECEIPT: (id: string) => `${API_PREFIX}/mall/orders/${id}/confirm-receipt`,
  MERCHANT_TREASURY: `${API_PREFIX}/merchant/treasury`,
  MERCHANT_TREASURY_TX: `${API_PREFIX}/merchant/treasury/transactions`,
  MERCHANT_GIFTS: `${API_PREFIX}/merchant/gifts`,
  MERCHANT_GIFT_OFFSHELF: (id: string) => `${API_PREFIX}/merchant/gifts/${id}/offshelf`,
  MERCHANT_GIFT_IMAGE: `${API_PREFIX}/merchant/gifts/image`,
  MERCHANT_GIFT_ORDERS: `${API_PREFIX}/merchant/gift-orders`,
  MERCHANT_GIFT_ORDER_SHIP: (id: string) => `${API_PREFIX}/merchant/gift-orders/${id}/ship`,
  // v1.7.19 寻货：feed/详情/发布/应答/选定/取消/我的列表（BFF /mobile/sourcing/*）
  SOURCING_DEMANDS: `${API_PREFIX}/sourcing/demands`,
  // v1.7.21 额度可见化：发布/应答额度条与按钮三态数据源
  SOURCING_QUOTA: `${API_PREFIX}/sourcing/quota`,
  // v1.7.21 应答预填（我的在售同款）与需求信号（反向导购横幅）
  SOURCING_MY_OFFERING: `${API_PREFIX}/sourcing/my-offering`,
  SOURCING_OPPORTUNITIES: `${API_PREFIX}/sourcing/opportunities`,
  SOURCING_MY_DEMANDS: `${API_PREFIX}/sourcing/my/demands`,
  SOURCING_MY_RESPONSES: `${API_PREFIX}/sourcing/my/responses`,
  /** v2.12.0 商户工作台"寻货管理-我发布的" */
  SOURCING_MERCHANT_DEMANDS: `${API_PREFIX}/sourcing/merchant/demands`,
  /** v2.12.0 列表删除：批量软删寻货终态单（左滑单删=ids 传一个）。改动说明：上一批插入脚本因 PS ${} 插值静默失败漏了本行，致 RN 端 URL 拼成 ...undefined 报 Network request failed */
  SOURCING_BATCH_DELETE: `${API_PREFIX}/sourcing/demands/batch-delete`,

  /** 个人 */
  PROFILE: `${API_PREFIX}/profile`,
  FAVORITES: `${API_PREFIX}/favorites`,
  FOLLOWED: `${API_PREFIX}/followed`,
  // 改动说明：原 HISTORY=/mobile/history 指向不存在的 BFF 端点（恒 404），
  // 浏览历史改由下方 /me/history/* 真实端点承载（轴承/商家分列）。
  HISTORY: `${API_PREFIX}/history`,

  /** 个人写操作（BFF /mobile/me/* 代理到 API /api/me/*，透传用户令牌） */
  FAVORITE_TOGGLE: (id: string) => `${API_PREFIX}/me/favorites/${id}`,
  FAVORITE_CHECK: (id: string) => `${API_PREFIX}/me/favorites/${id}/check`,
  FOLLOW_TOGGLE: (id: string) => `${API_PREFIX}/me/follows/${id}`,
  FOLLOW_CHECK: (id: string) => `${API_PREFIX}/me/follows/${id}/check`,
  HISTORY_BEARINGS: `${API_PREFIX}/me/history/bearings`,
  HISTORY_MERCHANTS: `${API_PREFIX}/me/history/merchants`,
  HISTORY_RECORD_BEARING: (id: string) => `${API_PREFIX}/me/history/bearings/${id}`,
  HISTORY_RECORD_MERCHANT: (id: string) => `${API_PREFIX}/me/history/merchants/${id}`,
  HISTORY_CLEAR: `${API_PREFIX}/me/history/clear`,
  /** v2.12.0 列表多选批量操作 */
  FAVORITES_BATCH_REMOVE: `${API_PREFIX}/favorites/batch-remove`,
  FOLLOWS_BATCH_REMOVE: `${API_PREFIX}/follows/batch-remove`,
  HISTORY_BATCH_DELETE: `${API_PREFIX}/history/batch-delete`,
    // 信息纠错（v1.7.14）：字段清单/提交/我的列表（BFF /mobile/me/corrections/* 代理 API /api/me/corrections/*）
    CORRECTION_FIELDS: (targetType: string, targetId: string) => `${API_PREFIX}/me/corrections/fields/${targetType}/${targetId}`,
    CORRECTION_SUBMIT_BEARING: (id: string) => `${API_PREFIX}/me/corrections/bearings/${id}`,
    CORRECTION_SUBMIT_MERCHANT: (id: string) => `${API_PREFIX}/me/corrections/merchants/${id}`,
    MY_CORRECTIONS: `${API_PREFIX}/me/corrections`,
    PROFILE_UPDATE: `${API_PREFIX}/me/profile`,
    // 改动说明（短信登录上线）：设置/修改密码（验证码登录注册的账号首次设置密码走这里，
    // BFF 代理 Identity /api/account/me/change-password）
    CHANGE_PASSWORD: `${API_PREFIX}/profile/change-password`,
    // 注销账户（v1.7.12）：真注销——服务端守卫+关系清理+Identity 禁用吊销（原为纯本地清缓存假注销）
    ACCOUNT_DEACTIVATE: `${API_PREFIX}/me/deactivate`,
  /** 头像上传（multipart，BFF 代理到 API 落盘并返回绝对 URL） */
  AVATAR_UPLOAD: `${API_PREFIX}/me/avatar`,

  /** 配置 */
  CONFIG: `${API_PREFIX}/config`,
  /** 版本更新检查（BFF /mobile/version/check 匿名代理到 API） */
  VERSION_CHECK: `${API_PREFIX}/version/check`,
} as const
