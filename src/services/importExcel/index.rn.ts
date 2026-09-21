// Excel 文件选择（RN 端，v1.7.7 三端打通）：react-native-document-picker v9
// （Android SAF ACTION_OPEN_DOCUMENT，无需存储权限；iOS document picker）。
// Metro 按 .rn.ts 后缀自动解析，替代 index.ts（其 DOM/小程序实现 RN 不可用）。
// 依赖为原生库：需重新构建安装 APK 后生效（Metro 热更不含新原生模块）。
import DocumentPicker from 'react-native-document-picker'
import type { PickedExcel } from './index'

/** 选择 Excel 文件；用户取消返回 null（pickSingle 取消抛 CANCELED 规范化为 null） */
export async function chooseExcelFile(): Promise<PickedExcel | null> {
  try {
    const res = await DocumentPicker.pickSingle({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        // 部分文件管理器 MIME 不标准，退而按扩展名过滤
        'com.microsoft.excel.xls'
      ],
      copyTo: 'cachesDirectory'
    })
    // copyTo 后取缓存副本（content:// URI 对 fetch 不稳定，复制为文件路径更可靠）
    const path = res.fileCopyUri || res.uri
    if (!path) return null
    return { path, name: res.name || undefined, mimeType: res.type || undefined }
  } catch (e) {
    if (DocumentPicker.isCancel(e)) return null
    throw e
  }
}
