// ListKit·ListActionSheet：长按卡片的上下文菜单（对齐安卓短信/邮件长按弹菜单范式）。
// 自绘底部弹层（三端同构，不依赖原生 ActionSheet——RN 样式不可控 + 6 项上限）；
// 菜单项由各列表按"该条可用操作"动态传入（如通知=已读/删除/多选；寻货终态=删除/多选），
// 危险项红底；末行固定"取消"。点遮罩=取消。
// RN 约束：flex、数值行高、Text 包裹。
import { View, Text } from '@tarojs/components'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import Icon from '../Icon'

/** 菜单动作项 */
export interface ListSheetAction {
  key: string
  label: string
  /** 危险操作红底白字（删除类） */
  danger?: boolean
  /** lucide 图标名 */
  icon?: string
  onPress: () => void
}

interface Props {
  visible: boolean
  /** 菜单标题（如"消息操作"） */
  title?: string
  actions: ListSheetAction[]
  onClose: () => void
}

/** 弹层固定动作槽位数（全站最长菜单=通知"标已读/删除/多选"3 项）。
 *  改动说明（RN 崩溃根治 v2）：行数恒定 + 常驻挂载 + display 切换 = 任意显隐/内容变化
 *  都只产生 updateView 样式与文本 props，零 manageChildren 结构 ops，
 *  与列表重渲染的 UI 队列竞态从源头消失；页面无需保证 actions 数组长度恒定。 */
const MAX_ACTIONS = 3

/** 长按上下文菜单弹层 */
export default function ListActionSheet({ visible, title, actions, onClose }: Props) {
  const t = useTheme()
  const fs = useFs()
  // 改动说明（RN 崩溃根治 v4·真凶）：position:'fixed' 在 RN 是非法值，样式 setter 抛
  // JSApplicationIllegalArgumentException 打断 UI 队列，次生崩溃
  // （ViewManager for tag could not be found）——RN 端改 absolute，配合页面把本组件
  // 放进 PageLayout overlay 插槽（根 View 直下）即等同全屏遮罩；H5/小程序保留 fixed
  return (
      <View
        style={{ position: process.env.TARO_ENV === 'rn' ? 'absolute' : 'fixed', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: visible ? 'flex' : 'none', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 9998 }}
        onClick={onClose}
      >
      <View
        style={{ backgroundColor: t.bgCard, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 改动说明：删除手动 lineHeight——fs(13) 已按平台输出正确行高（RN 数值/H5 px 串），
            原 `${fs(13).fontSize}px` 在 RN 端产出字符串样式、H5 端产出 "16pxpx" 无效值。
            Text 常驻（无标题时空串），避免条件挂载结构 ops */}
        <Text style={{ ...fs(13), color: t.textTertiary, textAlign: 'center', marginBottom: 6 }}>{title || ''}</Text>
        {Array.from({ length: MAX_ACTIONS }, (_, i) => {
          const a = actions[i]
          return (
            <View
              key={`slot-${i}`}
              style={{ display: a ? 'flex' : 'none', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 12, marginBottom: 8, backgroundColor: a?.danger ? t.danger : t.bgInput }}
              onClick={() => { if (a) { onClose(); a.onPress() } }}
            >
              {/* Icon 常驻（无动作时容器 display 隐藏、name 用兜底值），保证行内零结构变化 */}
              <View style={{ marginRight: 6, display: a?.icon ? 'flex' : 'none' }}><Icon name={a?.icon || 'trash-2'} size={18} color={a?.danger ? '#FFFFFF' : t.textPrimary} /></View>
              <Text style={{ ...fs(15), color: a?.danger ? '#FFFFFF' : t.textPrimary }}>{a?.label || ''}</Text>
            </View>
          )
        })}
        <View style={{ display: 'flex', alignItems: 'center', height: 44, justifyContent: 'center' }} onClick={onClose}>
          <Text style={{ ...fs(15), color: t.textTertiary }}>取消</Text>
        </View>
      </View>
    </View>
  )
}
