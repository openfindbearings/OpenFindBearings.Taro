// RN 端 multipart 上传实现：原生 fetch + FormData。
// 改动说明（v1.7.1 真机排障）：Taro 3.6 RN 的 uploadFile 在 createFormData 里把文件部分
// 硬编码为 name:'file'（丢失扩展名）且回调返回原生 Response 形状，导致上游按扩展名校验
// 的文件类型全部 400。RN 的 fetch FormData 支持 {uri,name,type} 文件对象，这里直发并
// 保留真实文件名；语义与 H5 版一致，resolve 标准 {statusCode,data}。
import type { NormalizedUploadResult } from './index'

/** 按扩展名给 MIME（图片为主，pdf/xlsx/xls 兜底） */
function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split('.').pop() || ''
  if (ext === 'png') return 'image/png'
  if (ext === 'pdf') return 'application/pdf'
  // 改动说明（v1.7.7）：Excel 导入接入，补办公文档 MIME（后端 GetSafeExtension 同表）
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (ext === 'xls') return 'application/vnd.ms-excel'
  return 'image/jpeg'
}

/**
 * 上传单个文件（字段名固定 file），带超时控制。
 * 用户取消/网络失败 reject（errMsg 含 cancel 供上层归一化文案）。
 * 改动说明（v1.7.7）：fileName/fileType 由调用方显式传入（document-picker 返回真实名与 MIME），
 *   未传时回退 uri 末段 + 扩展名推断。
 */
export async function uploadFileNormalized(opts: {
  url: string
  filePath: string
  header?: Record<string, string>
  formData?: Record<string, string>
  timeout?: number
  fileName?: string
  fileType?: string
}): Promise<NormalizedUploadResult> {
  const fd = new FormData()
  if (opts.formData) {
    Object.keys(opts.formData).forEach((k) => fd.append(k, opts.formData![k]))
  }
  // 取 uri 末段作为真实文件名（保留扩展名，上游类型校验依赖它）
  const clean = opts.filePath.replace(/^file:\/\//, '')
  const name = opts.fileName || clean.substring(clean.lastIndexOf('/') + 1) || 'file.jpg'
  // RN FormData 文件对象约定（Metro 网络层识别 {uri,name,type}）
  fd.append('file', { uri: opts.filePath, name, type: opts.fileType || mimeFromName(name) } as any)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeout ?? 60000)
  try {
    const res = await fetch(opts.url, {
      method: 'POST',
      headers: opts.header,
      body: fd,
      signal: controller.signal
    })
    const data = await res.text()
    return { statusCode: res.status, data }
  } catch (e) {
    // AbortController 触发即超时/取消，errMsg 含 cancel 语义供上层文案归一
    throw new Error(`uploadFile:fail ${(e as { message?: string })?.message || 'cancel'}`)
  } finally {
    clearTimeout(timer)
  }
}
