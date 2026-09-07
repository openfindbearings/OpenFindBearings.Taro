// 搜索页页面配置
// 关闭 RN 端外层 ScrollView 包裹，页面内自管滚动布局（NavBar 顶部固定）
// 改动说明：修复 RN 端 position: fixed/sticky 崩溃，改为 flex 布局实现固定顶部导航
export default {
  disableScroll: true,
  navigationStyle: 'custom'
}
