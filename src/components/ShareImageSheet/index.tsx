// 分享素材面板：展示后端生成的图片（二维码 / 海报），供扫码查看或保存到相册。
// 自绘 absolute 覆盖层（RN 无 fixed），样式内联走主题 token，与信息纠错面板同一套交互。
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'

interface Props {
  /** 是否可见（false 时整体不渲染，避免隐藏层拦截触摸） */
  visible: boolean
  /** 面板标题，如「分享 6205 · SKF 二维码」 */
  title: string
  /** 图片地址（BFF /mobile/share/qr 或 /mobile/share/poster 返回的 PNG） */
  imageUrl: string
  /** 副标题提示（如「微信扫一扫，或长按图片识别二维码」） */
  hint?: string
  /** 图片展示尺寸（正方形边长），海报默认 220 即可 */
  imageSize?: number
  /** 关闭回调 */
  onClose: () => void
}

/**
 * 分享素材面板：展示图片、提示使用方式、提供预览/保存入口。
 */
export default function ShareImageSheet({ visible, title, imageUrl, hint, imageSize = 220, onClose }: Props) {
  const t = useTheme()
  const fs = useFs()

  if (!visible) return null

  // 预览图片：小程序可直接长按保存到相册；H5 由 Taro 接管预览；RN 无原生预览，提示截图
  const handlePreview = () => {
    if (process.env.TARO_ENV === 'rn') {
      Taro.showToast({ title: '请直接截图保存', icon: 'none' })
      return
    }
    Taro.previewImage({ urls: [imageUrl], current: imageUrl })
  }

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <View
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.bgCard, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}
        onClick={process.env.TARO_ENV === 'rn' ? undefined : (e) => e?.stopPropagation?.()}
      >
        <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ ...fs(17), fontWeight: 'bold', color: t.textPrimary, flexShrink: 1 }} numberOfLines={1}>{title}</Text>
          <Icon name="x" size={20} color={t.textTertiary} onClick={onClose} />
        </View>

        <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4, paddingBottom: 8 }}>
          {imageUrl ? (
            <Image src={imageUrl} mode='widthFix' style={{ width: imageSize, height: imageSize, backgroundColor: '#FFFFFF', borderRadius: 8 }} />
          ) : (
            <View style={{ width: imageSize, height: imageSize, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bgInput, borderRadius: 8 }}>
              <Text style={{ ...fs(13), color: t.textTertiary }}>图片生成中</Text>
            </View>
          )}
          {!!hint && <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 12, textAlign: 'center' }}>{hint}</Text>}
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