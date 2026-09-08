export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/merchant/index',
    'pages/my/index',
    'pages/home/search',
    'pages/home/bearingDetail',
    'pages/merchant/merchantDetail',
    'pages/my/settings',
    'pages/my/all-features',
    'pages/common/doc'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '轴承查询',
    navigationBarTextStyle: 'black',
    // 改动说明：全站页面均使用自定义 NavBar，故在 window 级统一关闭 RN 原生顶栏，
    // 避免新增页面依赖各自 .config.ts 的 navigationStyle 被 Metro 识别（新页曾漏关）。
    navigationStyle: 'custom'
  }
})
