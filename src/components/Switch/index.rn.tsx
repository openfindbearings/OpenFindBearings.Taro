// 主题化开关（RN 端）：直接用 react-native 原生 Switch，完整控制轨道/圆点色，
// 使其跟随主题模式与主色。Taro 的 <Switch> 在 RN 下只映射 trackColor、不设 thumbColor，
// 导致圆点恒为系统默认绿（真机反馈），故 RN 端绕开 Taro Switch 用原生组件。
// API：checked + onChange(boolean)（与 H5 版 components/Switch/index.tsx 保持一致）。
import { Switch as RNSwitch } from 'react-native'
import { useTheme } from '../../hooks/useTheme'

interface SwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
}

export default function Switch({ checked, onChange }: SwitchProps) {
  const t = useTheme()
  return (
    <RNSwitch
      value={checked}
      onValueChange={onChange}
      // 轨道：开=主色，关=输入底（深色下不再是刺眼白）
      trackColor={{ false: t.bgInput, true: t.primary }}
      // 圆点：开=白，关=卡片底（跟随主题，修掉默认绿色）
      thumbColor={checked ? '#FFFFFF' : t.bgCard}
      ios_backgroundColor={t.bgInput}
    />
  )
}
