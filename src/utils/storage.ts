import Taro from '@tarojs/taro'

/** 跨端安全存储：RN 不支持同步 Storage API，统一用异步封装 */

/** 异步读取 */
export async function getItem(key: string): Promise<string | null> {
  try {
    return (await Taro.getStorage({ key }))?.data ?? null
  } catch {
    return null
  }
}

/** 异步写入 */
export async function setItem(key: string, value: string): Promise<void> {
  try {
    await Taro.setStorage({ key, data: value })
  } catch { /* ignore */ }
}

/** 异步删除 */
export async function removeItem(key: string): Promise<void> {
  try {
    await Taro.removeStorage({ key })
  } catch { /* ignore */ }
}

/** 获取对象（JSON 反序列化） */
export async function getObject<T = any>(key: string): Promise<T | null> {
  const raw = await getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** 保存对象（JSON 序列化） */
export async function setObject(key: string, value: any): Promise<void> {
  await setItem(key, JSON.stringify(value))
}
