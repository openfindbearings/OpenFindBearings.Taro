// 分享按钮（v1.6.0 搜索寻货联动）：三端统一入口。
// 小程序（微信/抖音）用 <Button open-type='share'> 走原生分享菜单（标题/路径由页面 useShareMessage 设置）；
// H5/RN 用普通 View + 命令式 shareContent（Web Share / 复制链接 / RN 原生 Share）。
import { View, Text, Button } from '@tarojs/components'
import Icon from '../Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { shareContent } from '../../utils/share'

// 改动说明（v1.7.47）：微信/抖音小程序原生 button 自带 ::after 伪元素边框，
// 与组件内联圆角描边叠加会露出错位直线；按平台条件引入覆盖样式，
// H5/RN 走 View 分支，不进伪元素规则（避免 RN 样式转换不支持 ::after）
if (process.env.TARO_ENV === 'weapp') require('./index.weapp.scss')
if (process.env.TARO_ENV === 'tt') require('./index.tt.scss')

/** 分享按钮属性 */
export interface ShareButtonProps {
  /** 分享标题 */
  title: string
  /** 落地页面路径（含 query） */
  path: string
  /** 可选配图 */
  imageUrl?: string
  /** 文字标签（默认"分享"） */
  label?: string
}

/** 分享按钮：小程序原生分享 / H5·RN 命令式分享 */
export default function ShareButton({ title, path, imageUrl, label = '分享' }: ShareButtonProps) {
  const t = useTheme()
  const fs = useFs()
  const env = process.env.TARO_ENV
  const nativeShare = env === 'weapp' || env === 'tt'

  const inner = (
    <>
      <Icon name="share-2" size={16} color={t.textSecondary} />
      <Text style={{ ...fs(14), color: t.textSecondary, marginLeft: 6 }}>{label}</Text>
    </>
  )
  const style = {
    display: 'flex', flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'center',
    paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8,
    borderRadius: 20, borderWidth: 1, borderColor: t.border, backgroundColor: 'transparent',
  }

  // 小程序：原生分享菜单（open-type=share），点按由平台接管；
  // 改动说明（v1.7.47）：加 className，供平台后缀样式清除微信/抖音原生 button 默认 ::after 边框
  if (nativeShare) {
    return (
      <Button openType="share" className="share-btn" style={{ ...style, margin: 0, height: 'auto', lineHeight: 'normal' }}>
        {inner}
      </Button>
    )
  }
  // H5/RN：命令式分享
  return (
    <View style={style} onClick={() => void shareContent({ title, path, imageUrl })}>
      {inner}
    </View>
  )
}