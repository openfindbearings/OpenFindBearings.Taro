// 统一 NavBar 组件
// 设计：标题居中，左侧返回箭头（条件），右侧自定义 slot（条件）
// 三栏布局：左 60px | 中 flex:1 | 右 60px，确保标题始终居中
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft } from 'lucide-react-taro'
import './index.scss'

interface NavBarProps {
  /** 标题 */
  title: string
  /** 是否显示返回按钮（默认 false） */
  showBack?: boolean
  /** 返回按钮点击事件，默认 Taro.navigateBack() */
  onBack?: () => void
  /** 右侧自定义 slot */
  rightSlot?: React.ReactNode
  /** 是否固定顶部（默认 true） */
  fixed?: boolean
}

export default function NavBar({
  title,
  showBack = false,
  onBack,
  rightSlot,
  fixed = true
}: NavBarProps) {
  // 默认返回行为：调用 Taro.navigateBack()
  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      Taro.navigateBack()
    }
  }

  return (
    <View className={`navbar ${fixed ? 'navbar-fixed' : ''}`}>
      {/* 左侧栏：返回按钮 */}
      <View className='navbar-left'>
        {showBack && (
          <View className='navbar-icon' onClick={handleBack}>
            <ArrowLeft size={22} />
          </View>
        )}
      </View>

      {/* 中间栏：标题 */}
      <View className='navbar-center'>
        <Text className='navbar-title'>{title}</Text>
      </View>

      {/* 右侧栏：自定义 slot */}
      <View className='navbar-right'>
        {rightSlot}
      </View>
    </View>
  )
}
