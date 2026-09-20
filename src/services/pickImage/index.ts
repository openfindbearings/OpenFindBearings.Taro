// H5/小程序端选图实现（RN 端由 index.rn.ts 提供 expo 版本，Metro 自动解析）
// 统一语义：resolve 临时文件路径；用户取消返回 null；权限/环境失败 reject。
import Taro from '@tarojs/taro'

/** 选择一张图片，返回本地临时路径；用户取消返回 null */
export async function pickImagePath(): Promise<string | null> {
  const r = await Taro.chooseImage({ count: 1, sizeType: ['compressed'] })
  return r.tempFilePaths?.[0] ?? null
}
