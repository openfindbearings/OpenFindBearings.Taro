// 主题化开关（H5/小程序端）：用 Taro <Switch>，color 传主色。
// API 与 RN 版 components/Switch/index.rn.tsx 一致：checked + onChange(boolean)。
import { Switch as TaroSwitch } from '@tarojs/components'
import { useTheme } from '../../hooks/useTheme'

interface SwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
}

export default function Switch({ checked, onChange }: SwitchProps) {
  const t = useTheme()
  return (
    <TaroSwitch
      checked={checked}
      color={t.primary}
      onChange={(e) => onChange(e.detail.value)}
    />
  )
}
