// 分享按钮（v1.6.0 搜索寻货联动）：三端统一入口。
// 小程序（微信/抖音）用 <Button open-type='share'> 走原生分享菜单（标题/路径由页面 useShareMessage 设置）；
// H5/RN 用普通 View + 命令式 shareContent（Web Share / 复制链接 / RN 原生 Share）。
import type { CSSProperties } from 'react'
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
  /** 覆写外层样式（改动说明 v1.60.0：详情页底部次级按钮行需要 flex:1 让分享按钮占满一格） */
  style?: CSSProperties
  /** 图标与文字颜色（默认次要文字色；详情页用主题色强调分享是引流入口） */
  color?: string
}

/** 分享按钮：小程序原生分享 / H5·RN 命令式分享 */
export default function ShareButton({ title, path, imageUrl, label = '分享', style: outerStyle, color }: ShareButtonProps) {
  const t = useTheme()
  const fs = useFs()
  const env = process.env.TARO_ENV
  const nativeShare = env === 'weapp' || env === 'tt'
  // 改动说明（v1.60.0）：颜色可覆写，未传时沿用原次要文字色，避免影响既有调用方
  const fg = color || t.textSecondary

  const inner = (
    <>
      <Icon name="share-2" size={16} color={fg} />
      <Text style={{ ...fs(14), color: fg, marginLeft: 6 }}>{label}</Text>
    </>
  )
  const style = {
    display: 'flex', flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'center',
    paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8,
    borderRadius: 20, borderStyle: 'solid', borderWidth: 1, borderColor: t.border, backgroundColor: 'transparent',
  }

  // 小程序：原生分享菜单（open-type=share），点按由平台接管；
  // 改动说明（v1.7.47）：加 className，供平台后缀样式清除微信/抖音原生 button 默认 ::after 边框
  if (nativeShare) {
    // 改动说明（v1.9 底部三钮不对齐）：margin/lineHeight 原先写在 ...outerStyle 之后，
    // 把调用方传的 height/margin 覆盖掉，小程序端按钮变成内容自适应高度、无外边距，
    // 与并排的固定 44 高按钮不在一条线上；改为基础复位在前、调用方样式在后
    return (
      <Button openType="share" className="share-btn" style={{ ...style, margin: 0, lineHeight: 'normal', ...outerStyle }}>
        {inner}
      </Button>
    )
  }
  // H5/RN：命令式分享
  return (
    <View style={{ ...style, ...outerStyle }} onClick={() => void shareContent({ title, path, imageUrl })}>
      {inner}
    </View>
  )
}