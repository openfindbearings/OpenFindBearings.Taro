// 保存网络图片到相册（H5 / 小程序）。
// 改动说明（v1.4.26）：分享面板改为淘宝式「海报卡 + 保存图片」，
// 小程序需先 downloadFile 拿本地临时文件再 saveImageToPhotosAlbum；
// H5 用 a[download] 触发浏览器下载。
import Taro from '@tarojs/taro'

/** 保存网络图片到相册/下载，成功返回 true，失败抛出由调用方提示 */
export async function saveImageToAlbum(url: string): Promise<boolean> {
  if (process.env.TARO_ENV === 'h5') {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`download failed: ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = (url.split('?')[0].split('/').pop() || 'poster') + '.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)
    return true
  }

  const download = await Taro.downloadFile({ url })
  if (download.statusCode !== 200) throw new Error(`download failed: ${download.statusCode}`)
  await Taro.saveImageToPhotosAlbum({ filePath: download.tempFilePath })
  return true
}