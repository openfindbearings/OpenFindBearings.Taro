export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/merchant/index',
    'pages/profile/index',
  ],
  tabBar: {
    color: '#999',
    selectedColor: '#1890ff',
    backgroundColor: '#fff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/tab-home.png',
        selectedIconPath: 'assets/tab-home-active.png',
      },
      {
        pagePath: 'pages/merchant/index',
        text: '入驻/商家',
        iconPath: 'assets/tab-merchant.png',
        selectedIconPath: 'assets/tab-merchant-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tab-profile.png',
        selectedIconPath: 'assets/tab-profile-active.png',
      },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'OpenFindBearings',
    navigationBarTextStyle: 'black',
  },
})
