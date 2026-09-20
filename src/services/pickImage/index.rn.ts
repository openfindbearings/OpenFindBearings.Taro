// RN 端选图实现：react-native-image-picker（活跃维护的标准 RN 库，RN CLI autolinking 零配置，
// Android 13+ 使用 READ_MEDIA_IMAGES 细分媒体权限——替代已停更、只申请废弃存储权限的 syan）。
// 统一语义与 H5 版一致：resolve 图片 uri；取消返回 null；权限被拒/出错 reject（调用方 toast 出真实原因）。
import Taro from '@tarojs/taro'
import { launchImageLibrary, launchCamera } from 'react-native-image-picker'

/** 从相册选择一张图片
 * 改动说明（v1.7.1）：加 maxWidth/maxHeight 缩放——高分辨率手机原片常超服务端 5MB 上限，
 * 压到长边 1600 + 质量 0.7 后证照图片一般 <1MB */
function pickFromLibrary(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        selectionLimit: 1,
        // 压缩质量（对应 H5 端 sizeType: compressed 语义）
        quality: 0.7,
        maxWidth: 1600,
        maxHeight: 1600
      },
      (result) => {
        if (result.didCancel) return resolve(null)
        if (result.errorCode) {
          const msg =
            result.errorCode === 'permission_denied'
              ? '相册权限被拒绝，请到系统设置-应用-权限中允许访问照片'
              : result.errorMessage || '打开相册失败'
          return reject(new Error(msg))
        }
        const uri = result.assets && result.assets.length > 0 ? result.assets[0].uri : undefined
        if (!uri) return reject(new Error('未获取到图片'))
        resolve(uri)
      }
    )
  })
}

/** 拍照一张（库内部自动申请 CAMERA 权限，被拒时以 permission_denied 错误码回传） */
function pickFromCamera(): Promise<string | null> {
  return new Promise<string | null>((resolve, reject) => {
    launchCamera({ mediaType: 'photo', quality: 0.7, maxWidth: 1600, maxHeight: 1600 }, (result) => {
      if (result.didCancel) return resolve(null)
      if (result.errorCode) {
        const msg =
          result.errorCode === 'permission_denied'
            ? '相机权限被拒绝，请到系统设置-应用-权限中允许使用相机'
            : result.errorMessage || '拍照失败'
        return reject(new Error(msg))
      }
      const uri = result.assets && result.assets.length > 0 ? result.assets[0].uri : undefined
      if (!uri) return reject(new Error('未获取到照片'))
      resolve(uri)
    })
  })
}

/** 选择图片（拍照 / 相册二选一），返回本地临时路径；用户取消返回 null
 * 改动说明：面板用 Taro.showActionSheet（RN 端由 taro-rn root-siblings 实现，与全站类型选择同款；
 * 此前误用 showActionSheetWithOptions——该别名仅 H5 端存在，RN 调用即抛被吞成"上传失败"） */
export function pickImagePath(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    Taro.showActionSheet({ itemList: ['拍照', '从相册选择'] })
      .then((res) => {
        const tap = (res as { tapIndex?: number }).tapIndex
        if (tap === 0) pickFromCamera().then(resolve, reject)
        else if (tap === 1) pickFromLibrary().then(resolve, reject)
        else resolve(null)
      })
      // 面板点取消/关闭：视为取消选图
      .catch(() => resolve(null))
  })
}
