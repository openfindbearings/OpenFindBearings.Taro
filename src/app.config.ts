export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/merchant/index',
    'pages/my/index',
    'pages/home/search',
    'pages/my/settings'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'OpenFindBearings',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    custom: true,
    color: '#999999',
    selectedColor: '#2563EB',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页'
      },
      {
        pagePath: 'pages/merchant/index',
        text: '入驻'
      },
      {
        pagePath: 'pages/my/index',
        text: '我的'
      }
    ]
  }
})
