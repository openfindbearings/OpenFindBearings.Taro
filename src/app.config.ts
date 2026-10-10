export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/discover/index',
    // v1.7.19 寻货：详情/发布 + 我的寻货 + 商家应答；v1.5.0 应答独立页
    'pages/discover/detail',
    'pages/discover/publish',
    'pages/discover/respond',
    'pages/my/sourcing',
    'pages/merchant/responses',
    'pages/merchant/demands',
    'pages/merchant/index',
    'pages/mall/index',
    'pages/merchant/apply',
    'pages/merchant/members',
    'pages/merchant/manage',
    'pages/merchant/gifts',
  'pages/merchant/treasury',
  'pages/games/index',
  'pages/games/linkup',
  'pages/rules/index',
    'pages/merchant/profile',
    'pages/notifications/index',
    'pages/my/index',
    'pages/home/search',
    'pages/home/bearingDetail',
    'pages/merchant/merchantDetail',
  // v2.6.0 双界面拆分：商家管理页（自家成员），merchantDetail 回归纯公开展示
  'pages/merchant/home',
  // v2.6.0 商家勋章展示页（管理页勋章卡落地，镜像个人勋章页）
  'pages/merchant/medals',
    'pages/my/settings',
    'pages/my/all-features',
    'pages/my/favorites',
    'pages/my/followed',
    'pages/my/history',
    'pages/my/corrections',
 'pages/my/points',
    // v2.13.0 等级玩法：个人段位详情页 + 商家等级详情页
    'pages/my/level',
    'pages/merchant/level',
    'pages/my/tasks',
    'pages/my/achievements',
'pages/my/permissions',
'pages/my/about',
    'pages/my/profile-edit',
    // 改动说明（短信登录上线）：设置/修改登录密码（验证码登录注册的账号首次设密）
    'pages/my/change-password',
    'pages/my/new-password',
    'pages/common/doc',
    'pages/auth/login'
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
