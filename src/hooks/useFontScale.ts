// 字号缩放 hook
// 用法：const fs = useFs(); <Text className='x' style={fs(15)}>…</Text>
// fs(base) 返回内联 { fontSize, lineHeight }，base 为该文本的设计基准字号（dp），
// 与 _rn.scss 的 $font-size-* token 对应。内联优先级高于 className 的静态字号，
// 从而实现运行时全局缩放；className 继续提供颜色/字重等非尺寸样式。
import { useFontSizeStore, FONT_SCALE } from '../stores/fontSize'
import { IS_RN } from '../utils/platform'

/** 当前缩放系数（响应式） */
export function useFontScale(): number {
  const size = useFontSizeStore((s) => s.size)
  return FONT_SCALE[size]
}

/** 返回 fs(base) 生成器，base 为设计基准字号 */
export function useFs() {
  const scale = useFontScale()
  return (base: number) => {
    const fontSize = Math.round(base * scale)
    const lineHeight = Math.round(base * scale * 1.4)
    // 改动说明：lineHeight 在 React 里是"无单位属性"，传数字会被 H5/浏览器当作"字号倍数"
    // （lineHeight:18 → 18×字号≈234px 行高），导致 H5 所有文字撑高、卡片/标签纵向拉伸；
    // 而 RN 把数字当绝对 dp，故 RN 正常。修法：H5 输出带 px 的字符串（=绝对像素），
    // RN 保持数值（AGENTS 规定 RN 的 fontSize/lineHeight 必须为数值）。
    return IS_RN
      ? { fontSize, lineHeight }
      : { fontSize: `${fontSize}px`, lineHeight: `${lineHeight}px` }
  }
}
