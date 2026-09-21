// Taro uploadFile 跨端响应归一化
// 背景（v1.7.1 真机排障结论）：Taro 3.6 RN 端 uploadFile 的 success 回调直接把 fetch 的
//   原生 Response 对象原样抛出（@tarojs/taro-rn dist/lib/file.js 未做形状转换），
//   只有 status/text()，没有小程序约定的 statusCode/data；H5/小程序端则是标准 {statusCode,data}。
//   本模块把两种形状统一归一化为 {statusCode, data}，调用方只面向标准形状写逻辑。
import Taro from '@tarojs/taro'

/** 归一化后的上传响应 */
export interface NormalizedUploadResult {
  statusCode: number
  data: string
}

/**
 * 归一化 Taro.uploadFile 的 success 回调参数。
 * RN 端收到的是 fetch Response（status + 异步 text()），H5/小程序为标准 {statusCode,data}；
 * 两者都不认识时 statusCode=0（调用方按失败处理）。
 */
export function normalizeUploadRes(res: any): Promise<NormalizedUploadResult> {
  if (res && typeof res.statusCode === 'number') {
    return Promise.resolve({ statusCode: res.statusCode, data: String(res.data ?? '') })
  }
  if (res && typeof res.status === 'number' && typeof res.text === 'function') {
    return res.text().then((body: string) => ({ statusCode: res.status, data: body }))
  }
  return Promise.resolve({ statusCode: 0, data: '' })
}

/**
 * Promise 风格上传（chooseImage 之后的临时路径 → multipart POST）。
 * 统一带 timeout（RN 默认 2 秒必超时）并归一化响应，resolve 标准形状。
 * 改动说明（v1.7.7）：加 fileName/fileType 可选参数（Excel 导入等场景携带真实文件名与 MIME）；
 *   H5/小程序端 Taro.uploadFile 不支持自定义文件名，忽略之（小程序路径自带扩展名，
 *   H5 blob 保留 File.type，后端 GetSafeExtension 有 MIME 兜底）。
 */
export function uploadFileNormalized(opts: {
  url: string
  filePath: string
  header?: Record<string, string>
  formData?: Record<string, string>
  timeout?: number
  fileName?: string
  fileType?: string
}): Promise<NormalizedUploadResult> {
  return new Promise((resolve, reject) => {
    Taro.uploadFile({
      url: opts.url,
      filePath: opts.filePath,
      name: 'file',
      timeout: opts.timeout ?? 60000,
      header: opts.header,
      formData: opts.formData,
      success: (res) => {
        normalizeUploadRes(res).then(resolve, reject)
      },
      fail: (err) => reject(err)
    })
  })
}
