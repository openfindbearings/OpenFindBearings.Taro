// 轴承详情页配置：关闭 RN 外层 ScrollView 包裹（页面内自管滚动），
// navigationStyle: 'custom' 去掉 RN 原生顶栏（否则与自定义 NavBar 重复显示"轴承查询"）。
// 改动说明：新页面需与其余页一致用纯对象导出，Metro dev 下 definePageConfig 宏不可靠。
export default {
  disableScroll: true,
  navigationStyle: 'custom'
}
