// 保存网络图片到相册（React Native）。
// 改动说明（v1.4.26）：RN 无内置相册写入能力，先用 react-native-blob-util 把图片下载到缓存，
// 再交给 @react-native-camera-roll/camera-roll 写入系统相册；首次保存由系统弹权限申请。
import { Platform } from 'react-native'
import ReactNativeBlobUtil from 'react-native-blob-util'
import { CameraRoll } from '@react-native-camera-roll/camera-roll'

/** 保存网络图片到相册，成功返回 true，失败抛出由调用方提示 */
export async function saveImageToAlbum(url: string): Promise<boolean> {
  const res = await ReactNativeBlobUtil.config({ fileCache: true, appendExt: 'png' }).fetch('GET', url)
  const rawPath = res.path()
  const fileUri = Platform.OS === 'ios' ? rawPath : `file://${rawPath}`
  await CameraRoll.save(fileUri, { type: 'photo' })
  await res.flush()
  return true
}