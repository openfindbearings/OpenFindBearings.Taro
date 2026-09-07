// 商家页页面配置
// 关闭 RN 端外层 ScrollView 包裹，页面内自管滚动布局（NavBar 顶部固定 / TabBar 底部固定）
// 改动说明：直接 export 纯对象，不走 definePageConfig 宏（原因详见 home/index.config.ts 改动说明）
export default {
  disableScroll: true,
  navigationStyle: 'custom'
}
