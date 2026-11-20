// 分享二维码面板（扫码与分享需求 v0.1.0 P0-3）：
// 展示 BFF 生成的二维码图片，供用户扫码查看或保存到相册用于线下物料。
// 自绘 absolute 覆盖层（RN 无 fixed），样式内联走主题 token，与信息纠错面板同一套交互。
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'

interface Props {
  /** 是否可见（false 时整体不渲染，避免隐藏层拦截触摸） */
  visible: boolean
  /** 面板标题，如「分享 6205 · SKF」 */
  title: string
  /** 二维码图片地址（BFF /s/qr 返回的 PNG） */
  qrUrl: string
  /** 关闭回调 */
  onClose: () => void
}

/**
 * 分享二维码面板：展示二维码、提示扫码方式、提供预览/保存入口。
 */
export default function ShareQrSheet({ visible, title, qrUrl, onClose }: Props) {
  const t = useTheme()
  const fs = useFs()

  if (!visible) return null

  // 预览图片：小程序可直接长按保存到相册；H5 由 Taro 接管预览；RN 无原生预览，提示截图
  const handlePreview = () => {
    if (process.env.TARO_ENV === 'rn') {
      Taro.showToast({ title: '请直接截图保存二维码', icon: 'none' })
      return
    }
    Taro.previewImage({ urls: [qrUrl], current: qrUrl })
  }

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <View
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.bgCard, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}
        onClick={process.env.TARO_ENV === 'rn' ? undefined : (e) => e?.stopPropagation?.()}
      >
        <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ ...fs(17), fontWeight: 'bold', color: t.textPrimary }} numberOfLines={1}>{title}</Text>
          <Icon name="x" size={20} color={t.textTertiary} onClick={onClose} />
        </View>

        <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4, paddingBottom: 8 }}>
          {qrUrl ? (
            <Image src={qrUrl} mode='widthFix' style={{ width: 220, height: 220, backgroundColor: '#FFFFFF', borderRadius: 8 }} />
          ) : (
            <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bgInput, borderRadius: 8 }}>
              <Text style={{ ...fs(13), color: t.textTertiary }}>二维码生成中</Text>
            </View>
          )}
          <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 12 }}>微信扫一扫，或长按图片识别二维码</Text>
          <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>保存图片后可印在名片、包装与展台物料上</Text>
        </View>

        <View
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 12, backgroundColor: t.primary, marginTop: 8 }}
          onClick={handlePreview}
        >
          <Text style={{ ...fs(15, true), color: t.textOnPrimary }}>查看大图 / 保存</Text>
        </View>
      </View>
    </View>
  )
}