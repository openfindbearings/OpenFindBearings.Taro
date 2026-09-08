// 首页页面配置
// 关闭 RN 端外层 ScrollView 包裹，页面内自管滚动布局（NavBar 顶部固定 / TabBar 底部固定）
// 改动说明：直接 export 纯对象，不走 definePageConfig 宏。Metro dev 模式下 .config.ts 的 definePageConfig
// 宏未被 babel-plugin 正确处理，导致 import 到的配置对象缺少 disableScroll 字段，runtime 仍走 createScrollPage 包裹
// 外层 ScrollView。改用纯对象导出后，taroTransformer 生成的 import 表达式能拿到正确的 { disableScroll: true }。
export default {
  disableScroll: true,
  navigationStyle: 'custom'
}
