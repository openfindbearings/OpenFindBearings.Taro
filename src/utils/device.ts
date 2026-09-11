import { getItem, setItem } from './storage'

/**
 * 设备标识工具。
 * 职责：为每个安装实例生成并持久化一个稳定的 device_id，供 Identity 做刷新令牌设备绑定。
 * 说明：device_id 为客户端自报、服务端仅做跨请求一致性比对（防误用/串设备，不防伪造）；
 * 卸载重装 storage 清空 → 生成新 ID → 旧 refresh 失效 → 强制重登（预期行为）。
 */

/** 设备标识存储键 */
const DEVICE_KEY = 'device_id'

/** 内存缓存，避免每次请求都读存储 */
let cachedDeviceId: string | null = null

/** 无第三方依赖的 GUID 生成（H5/RN 均可用） */
function genGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * 获取（必要时生成并持久化）当前设备 ID。
 * 首次调用生成随机 GUID 并落存储，之后复用同一值，保证同一安装实例内稳定。
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId
  const stored = await getItem(DEVICE_KEY)
  if (stored) {
    cachedDeviceId = stored
    return stored
  }
  const id = genGuid()
  await setItem(DEVICE_KEY, id)
  cachedDeviceId = id
  return id
}
