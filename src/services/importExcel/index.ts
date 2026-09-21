// Excel 文件选择（H5/小程序端，v1.7.7 三端打通）：
// 小程序用 chooseMessageFile（会话文件选取，微信生态主流导入路径）；
// H5 用隐藏 <input type=file>（浏览器文件选择，blob URL 上传，File.type 保留 MIME）。
// RN 端见 index.rn.ts（react-native-document-picker，Metro 自动解析 .rn 后缀）。
import Taro from '@tarojs/taro'

/** 选中的 Excel 文件描述：path 为上传用路径（小程序临时路径 / H5 blob URL） */
export interface PickedExcel {
  path: string
  /** 真实文件名（含扩展名；H5 有，小程序路径自带可留空） */
  name?: string
  /** MIME 类型（H5 File.type 携带；小程序留空由后端扩展名判定） */
  mimeType?: string
}

/** 选择 Excel 文件；用户取消返回 null */
export function chooseExcelFile(): Promise<PickedExcel | null> {
  if (process.env.TARO_ENV === 'weapp') {
    return new Promise((resolve, reject) => {
      Taro.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['xlsx', 'xls'],
        success: (res) => {
          const f = res.tempFiles && res.tempFiles[0]
          resolve(f ? { path: f.path } : null)
        },
        fail: (err) => reject(new Error(err?.errMsg || 'chooseExcelFile:fail cancel'))
      })
    })
  }

  // H5：动态创建 file input（DOM 仅限 H5 分支，RN 不解析此文件）。
  // 改动说明：浏览器无"取消选择"事件，用 window focus 兜底——对话框关闭重新聚焦时
  //   若 input.files 仍为空则判为取消，resolve null 防止上层 importing 状态永挂
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls'
    input.style.display = 'none'
    let settled = false
    const done = (v: PickedExcel | null) => {
      if (settled) return
      settled = true
      window.removeEventListener('focus', onFocus)
      input.remove()
      resolve(v)
    }
    input.onchange = () => {
      const file = input.files && input.files[0]
      done(file
        ? { path: URL.createObjectURL(file), name: file.name, mimeType: file.type || undefined }
        : null)
    }
    const onFocus = () => {
      // focus 晚于 onchange 触发一拍：延迟检查避免误判取消
      setTimeout(() => { if (!(input.files && input.files[0])) done(null) }, 300)
    }
    window.addEventListener('focus', onFocus)
    input.click()
  })
}
