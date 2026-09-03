import { create } from 'zustand'
import { getObject, setObject } from '../utils/storage'

/** 应用设置 */
export interface AppSettings {
  /** 简洁模式：首页仅显示搜索框 + 三个入口 */
  simpleHome: boolean
  /** 暗黑模式：light / dark / system */
  themeMode: 'light' | 'dark' | 'system'
}

const SETTINGS_KEY = 'app_settings'
const defaults: AppSettings = { simpleHome: false, themeMode: 'system' }

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...defaults },
  loaded: false,

  /** 从本地存储加载设置 */
  load: async () => {
    const saved = await getObject<AppSettings>(SETTINGS_KEY)
    if (saved) {
      set({ settings: { ...defaults, ...saved }, loaded: true })
    } else {
      set({ loaded: true })
    }
  },

  /** 更新并持久化设置 */
  update: async (patch) => {
    const next = { ...get().settings, ...patch }
    set({ settings: next })
    await setObject(SETTINGS_KEY, next)
  },
}))
