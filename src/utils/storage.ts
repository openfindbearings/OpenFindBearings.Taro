import Taro from '@tarojs/taro'

/**
 * 跨端本地存储封装
 * 小程序用 Taro.setStorageSync，H5 用 localStorage
 */
const storage = {
  /** 读取字符串 */
  get(key: string): string | null {
    try {
      if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
        return localStorage.getItem(key)
      }
      return Taro.getStorageSync(key) || null
    } catch {
      return null
    }
  },

  /** 写入字符串 */
  set(key: string, value: string): void {
    try {
      if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
        localStorage.setItem(key, value)
      } else {
        Taro.setStorageSync(key, value)
      }
    } catch { /* 忽略 */ }
  },

  /** 删除 */
  remove(key: string): void {
    try {
      if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
        localStorage.removeItem(key)
      } else {
        Taro.removeStorageSync(key)
      }
    } catch { /* 忽略 */ }
  },

  /** 清空全部 */
  clear(): void {
    try {
      if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
        localStorage.clear()
      } else {
        Taro.clearStorageSync()
      }
    } catch { /* 忽略 */ }
  },
}

export default storage
