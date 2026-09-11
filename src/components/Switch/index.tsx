// 主题化开关（H5/小程序端）：用 Taro <Switch>，color 传主色。
// API 与 RN 版 components/Switch/index.rn.tsx 一致：checked + onChange(boolean)。
import { Switch as TaroSwitch } from '@tarojs/components'
import { useTheme } from '../../hooks/useTheme'

interface SwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  /** 停用态：不可交互并置灰（暂未上线功能用），与 RN 版 API 一致 */
  disabled?: boolean
}

export default function Switch({ checked, onChange, disabled = false }: SwitchProps) {
  const t = useTheme()
  return (
    <TaroSwitch
      checked={checked}
      // 改动说明：透传 disabled 并整体降透明度置灰，表达"功能暂未上线不可操作"
      disabled={disabled}
      style={disabled ? { opacity: 0.4 } : undefined}
      color={t.primary}
      onChange={(e) => { if (!disabled) onChange(e.detail.value) }}
    />
  )
}
