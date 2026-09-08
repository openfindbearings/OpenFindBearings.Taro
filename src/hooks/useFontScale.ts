// 字号缩放 hook
// 用法：const fs = useFs(); <Text className='x' style={fs(15)}>…</Text>
// fs(base) 返回内联 { fontSize, lineHeight }，base 为该文本的设计基准字号（dp），
// 与 _rn.scss 的 $font-size-* token 对应。内联优先级高于 className 的静态字号，
// 从而实现运行时全局缩放；className 继续提供颜色/字重等非尺寸样式。
import { useFontSizeStore, FONT_SCALE } from '../stores/fontSize'

/** 当前缩放系数（响应式） */
export function useFontScale(): number {
  const size = useFontSizeStore((s) => s.size)
  return FONT_SCALE[size]
}

/** 返回 fs(base) 生成器，base 为设计基准字号 */
export function useFs() {
  const scale = useFontScale()
  return (base: number) => ({
    fontSize: Math.round(base * scale),
    lineHeight: Math.round(base * scale * 1.4)
  })
}
