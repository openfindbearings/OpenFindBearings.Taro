// 胶囊按钮右侧预留宽度 - 默认实现（H5 / RN）
// 改动说明：H5 与 RN 无微信胶囊按钮，右侧无需预留，恒返回 0。
// 小程序端由同目录 capsule.weapp.ts 覆盖本文件（Taro 平台后缀解析）。

/** 返回导航栏右侧需为胶囊按钮预留的宽度（px），H5/RN 恒为 0 */
export function capsuleRightReserve(): number {
  return 0
}
