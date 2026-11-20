// 分享按钮（三端统一入口）：点按打开分享面板，按端展示可用渠道。
// 小程序：使用原生 open-type=share 的按钮发卡片（标题/路径由页面 useShareMessage 设置），
//   复制链接、二维码、海报同样在面板内提供（站外分享与线下物料走这几个）。
// H5/RN：系统分享（Web Share / RN Share）、复制链接、二维码、海报。
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../Icon'
import ShareImageSheet from '../ShareImageSheet'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { shareContent, toShareUrl } from '../../utils/share'
import { getShareQrUrl, getSharePosterUrl, type ShareTarget } from '../../utils/shareQr'

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

/** 面板内展示的图片素材状态 */
interface SheetState {
  title: string
  url: string
  hint: string
}

/**
 * 分享按钮：打开分享面板，面板内提供发送/系统分享、复制链接、二维码与海报。
 */
export default function ShareButton({ title, path, imageUrl, label = '分享', style: outerStyle, color }: ShareButtonProps) {
  const t = useTheme()
  const fs = useFs()
  const env = process.env.TARO_ENV
  const nativeShare = env === 'weapp' || env === 'tt'
  const fg = color || t.textSecondary
  const [panelVisible, setPanelVisible] = useState(false)
  const [sheet, setSheet] = useState<SheetState | null>(null)

  // 从落地页路径解析目标类型与 id：/s/bearing/{id} 或 /s/merchant/{id}
  const match = path.match(/^\/s\/(bearing|merchant)\/([0-9a-fA-F-]{36})/)
  const target = (match?.[1] as ShareTarget | undefined) ?? null
  const targetId = match?.[2] ?? null

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

  /** 打开二维码或海报图片面板（先收起动作面板，避免两层叠加） */
  const openAsset = (kind: 'qr' | 'poster') => {
    if (!target || !targetId) return
    setPanelVisible(false)
    setSheet(kind === 'qr'
      ? { title: `${title}`, url: getShareQrUrl(target, targetId, 'qr'), hint: '微信扫一扫，或长按图片识别二维码' }
      : { title: `分享海报`, url: getSharePosterUrl(target, targetId, 'poster'), hint: '保存图片后可印在名片、包装与展台物料上' })
  }

  /** 复制落地页链接（站外分享兜底） */
  const handleCopy = async () => {
    await Taro.setClipboardData({ data: toShareUrl(path) })
    setPanelVisible(false)
    Taro.showToast({ title: '链接已复制', icon: 'none' })
  }

  /** H5/RN 调起系统分享面板 */
  const handleSystemShare = async () => {
    setPanelVisible(false)
    await shareContent({ title, path, imageUrl })
  }

  return (
    <>
      {nativeShare ? (
        // 小程序：按钮自身只负责打开面板（不在按钮上直接分享，面板内再提供原生分享）
        <Button className="share-btn" style={{ ...style, margin: 0, lineHeight: 'normal', ...outerStyle }} onClick={() => setPanelVisible(true)}>
          {inner}
        </Button>
      ) : (
        <View style={{ ...style, ...outerStyle }} onClick={() => setPanelVisible(true)}>
          {inner}
        </View>
      )}

      {panelVisible && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 100 }} onClick={() => setPanelVisible(false)}>
          <View
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.bgCard, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, zIndex: 101 }}
            onClick={env === 'rn' ? undefined : (e) => e?.stopPropagation?.()}
          >
            <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ ...fs(17), fontWeight: 'bold', color: t.textPrimary, flexShrink: 1 }} numberOfLines={1}>分享</Text>
              <Icon name="x" size={20} color={t.textTertiary} onClick={() => setPanelVisible(false)} />
            </View>

            <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
              {nativeShare && (
                <Button openType="share" className="share-btn" style={{ width: 72, margin: 0, padding: 0, backgroundColor: 'transparent', lineHeight: 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="message-circle" size={22} color={t.primary} />
                  </View>
                  <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 6 }}>发送给朋友</Text>
                </Button>
              )}
              {!nativeShare && (
                <View style={{ width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={() => void handleSystemShare()}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="share-2" size={22} color={t.primary} />
                  </View>
                  <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 6 }}>系统分享</Text>
                </View>
              )}
              <View style={{ width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={() => void handleCopy()}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="link" size={22} color={t.primary} />
                </View>
                <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 6 }}>复制链接</Text>
              </View>
              {target && targetId && (
                <>
                  <View style={{ width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={() => openAsset('qr')}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="qr-code" size={22} color={t.primary} />
                    </View>
                    <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 6 }}>二维码</Text>
                  </View>
                  <View style={{ width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={() => openAsset('poster')}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="image" size={22} color={t.primary} />
                    </View>
                    <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 6 }}>海报</Text>
                  </View>
                </>
              )}
            </View>

            <View
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 12, backgroundColor: t.bgInput, marginTop: 16 }}
              onClick={() => setPanelVisible(false)}
            >
              <Text style={{ ...fs(15), color: t.textSecondary }}>取消</Text>
            </View>
          </View>
        </View>
      )}

      <ShareImageSheet
        visible={!!sheet}
        title={sheet?.title ?? ''}
        imageUrl={sheet?.url ?? ''}
        hint={sheet?.hint}
        onClose={() => setSheet(null)}
      />
    </>
  )
}