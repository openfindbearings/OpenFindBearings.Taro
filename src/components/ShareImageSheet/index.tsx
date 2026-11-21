// 分享素材面板：展示后端生成的图片（二维码 / 海报），供扫码查看或保存到相册。
// 改动说明（v1.4.23）：覆盖层改用 OverlaySheet（H5/小程序 fixed、RN Modal），
// 修复面板嵌在滚动内容里被裁剪、与页面按钮重叠的问题；图片按 3:4 展示海报。
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../Icon'
import OverlaySheet from '../OverlaySheet'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { showTip } from '../../utils/toast'
import { saveImageToAlbum } from '../../utils/saveImage'

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
export default function ShareImageSheet({ visible, title, imageUrl, hint, imageSize = 240, onClose }: Props) {
  const t = useTheme()
  const fs = useFs()

  // 保存图片到相册：三端统一走 saveImageToAlbum（H5 下载、小程序相册、RN 原生写入）
  const handleSave = async () => {
    try {
      await saveImageToAlbum(imageUrl)
      showTip('已保存到相册')
    } catch {
      showTip('保存失败，请稍后重试')
    }
  }

  return (
    <OverlaySheet visible={visible} onClose={onClose}>
      <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ ...fs(17), fontWeight: 'bold', color: t.textPrimary, flexShrink: 1 }} numberOfLines={1}>{title}</Text>
        <Icon name="x" size={20} color={t.textTertiary} onClick={onClose} />
      </View>

      <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4, paddingBottom: 8 }}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            mode='aspectFit'
            style={{ width: imageSize, height: Math.round(imageSize * 4 / 3), backgroundColor: '#FFFFFF', borderRadius: 8 }}
          />
        ) : (
          <View style={{ width: imageSize, height: Math.round(imageSize * 4 / 3), alignItems: 'center', justifyContent: 'center', backgroundColor: t.bgInput, borderRadius: 8 }}>
            <Text style={{ ...fs(13), color: t.textTertiary }}>图片生成中</Text>
          </View>
        )}
        {!!hint && <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 12, textAlign: 'center' }}>{hint}</Text>}
      </View>

      <View
        style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 12, backgroundColor: t.primary, marginTop: 8 }}
        onClick={() => void handleSave()}
      >
        <Text style={{ ...fs(15, true), color: t.textOnPrimary }}>保存图片</Text>
      </View>
    </OverlaySheet>
  )
}