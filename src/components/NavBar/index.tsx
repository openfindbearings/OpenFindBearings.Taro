// 统一 NavBar 组件（v1.7.0 安全区标准改造）
// 标准 RN 结构：外层 View 以 paddingTop=insets.top 承让状态栏（背景色随外层铺满，
// 状态栏区域与导航栏同色，视觉无缝），内层固定 44/48dp 的内容行、
// 内容垂直居中——不再手工计算"总高 = 基准高 + 状态栏"的 border-box hack。
import { View, Text } from '@tarojs/components'
import Icon from '../Icon'
import Taro from '@tarojs/taro'
import { useSafeArea } from '../../utils/use-safe-area'
import { useFs } from '../../hooks/useFontScale'
import { useTheme } from '../../hooks/useTheme'
import './index.scss'

interface NavBarProps {
  /** 标题（centerSlot 为空时显示） */
  title?: string
  /** 中间栏自定义内容（优先于 title，首页普通模式用此传入搜索框） */
  centerSlot?: React.ReactNode
  /** 是否显示返回按钮（默认 false） */
  showBack?: boolean
  /** 返回按钮点击事件，默认 Taro.navigateBack() */
  onBack?: () => void
  /**
   * 右侧图标声明式配置（推荐）：由 NavBar 内部渲染，navbar-icon 类在 NavBar 文件作用域内，
   * 规避 Taro RN className 文件作用域限制（调用方传入的 rightSlot JSX 用 navbar-icon 不生效）。
   * 多图标自动加 navbar-icon-gap 间隔。
   */
  rightIcons?: Array<{ name: string; onClick: () => void; size?: number }>
  /** 右侧自定义 slot（复杂内容用；简单图标优先用 rightIcons） */
  rightSlot?: React.ReactNode
  /** 搜索模式：中间栏放搜索框，左右栏缩窄、整体增高到 48dp */
  searchMode?: boolean
}

export default function NavBar({
  title = '',
  centerSlot,
  showBack = false,
  onBack,
  rightIcons,
  rightSlot,
  searchMode = false
}: NavBarProps) {
  // 默认返回行为：调用 Taro.navigateBack()
  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      Taro.navigateBack()
    }
  }

  // 标准安全区：外层吃顶部内缩，内层固定基准高
  const { top } = useSafeArea()
  // 全局字号缩放：标题按 navbar-title 基准 17dp 缩放
  const fs = useFs()
  // 主题色板：导航栏背景/标题/返回图标随模式
  const t = useTheme()

  // 搜索模式（真机修复）：首页无返回/右侧内容时不渲染 96dp 侧栏，
  // 否则中间栏被两侧共吃掉 192dp，搜索框只剩一小截（京东/淘宝是搜索框铺满整栏）
  const showLeft = !searchMode || showBack
  const showRight = !searchMode || !!rightSlot || !!rightIcons

  return (
    <View
      className={`navbar ${searchMode ? 'navbar-search' : ''}`}
      style={{ paddingTop: top, backgroundColor: t.navBarBg, borderBottomColor: t.border }}
    >
      {/* 内层内容行：固定基准高，垂直居中 */}
      <View className={`navbar-inner ${searchMode ? 'navbar-inner-search' : ''}`}>
        {/* 左侧栏：返回按钮 */}
        {showLeft && (
          <View className='navbar-left'>
            {showBack && (
              <View className='navbar-icon' onClick={handleBack}>
                <Icon name="arrow_left" size={24} color={t.navBarText} />
              </View>
            )}
          </View>
        )}

        {/* 中间栏：搜索框（centerSlot）或标题 */}
        <View className='navbar-center'>
          {centerSlot || <Text className='navbar-title' style={{ ...fs(17), color: t.navBarText }}>{title}</Text>}
        </View>

        {/* 右侧栏：优先渲染声明式 rightIcons（类名在本文件作用域，稳定生效），
            右侧图标用紧凑触控框（32dp，与搜索框内 action-icon 同几何、glyph 间距约 10dp），
            返回按钮仍用 44dp navbar-icon 保证主操作可点。兼容自定义 rightSlot。 */}
        {showRight && (
          <View className='navbar-right'>
            {rightIcons &&
              rightIcons.map((ic) => (
                <View
                  key={ic.name}
                  className='navbar-right-icon'
                  onClick={ic.onClick}
                >
                  <Icon name={ic.name} size={ic.size ?? 24} color={t.navBarText} />
                </View>
              ))}
            {rightSlot}
          </View>
        )}
      </View>
    </View>
  )
}
