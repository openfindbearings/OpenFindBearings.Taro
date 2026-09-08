import LinearGradient from 'react-native-linear-gradient'
import type { GradientProps } from './types'

// 改动说明：RN 端直接使用 react-native-linear-gradient 原生组件，保持真机渐变。
// 与 index.tsx(H5/小程序 CSS 渐变) 按平台后缀分流，业务统一 import '../../components/Gradient'。
export default function Gradient(props: GradientProps) {
  return <LinearGradient {...(props as any)} />
}
