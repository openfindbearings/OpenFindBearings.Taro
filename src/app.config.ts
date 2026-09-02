export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/merchant/index',
    'pages/my/index',
    'pages/home/search'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'OpenFindBearings',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#2563EB',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/tabbar/home.png',
        selectedIconPath: 'assets/tabbar/home-active.png'
      },
      {
        pagePath: 'pages/merchant/index',
        text: '入驻',
        iconPath: 'assets/tabbar/merchant.png',
        selectedIconPath: 'assets/tabbar/merchant-active.png'
      },
      {
        pagePath: 'pages/my/index',
        text: '我的',
        iconPath: 'assets/tabbar/my.png',
        selectedIconPath: 'assets/tabbar/my-active.png'
      }
    ]
  }
})
