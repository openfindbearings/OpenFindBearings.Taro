const path = require('path')
const { mergeConfig } = require('metro-config')

module.exports = (async function () {
  // custom your metro config here
  // https://facebook.github.io/metro/docs/configuration
  const { getMetroConfig } = require('@tarojs/rn-supporter')
  const taroConfig = await getMetroConfig()

  // 本次改动：屏蔽 taro-rn 定位链路的两个未链接原生模块（geolocation / expo-location）。
  // geolocation 是 @tarojs/taro-rn 的传递依赖，RN 0.70 autolink 只处理 package.json 直接依赖，
  // 无法原生链接；其 implementation.js 顶层解构触发 new NativeEventEmitter(Proxy) 在 Hermes 下抛
  // LINKING_ERROR，中断 bundle 求值导致白屏。resolveRequest 把这两个模块名重定向到空替身。
  // 注意 1：不能用 mergeConfig 传 resolveRequest 做覆盖 —— mergeConfig(override, base) 对函数键以 base 为准，
  // Taro 的 getMetroConfig 自带 resolveRequest（handleEntryFile，负责虚拟入口注入）会盖掉我们的包装。
  // 注意 2：Metro 0.72 的 mergeConfig 要求 override 侧 resolver 必须存在（读 dependencyExtractor），
  // 因此 override 传 { resolver: {} } 占位，随后在最终对象上手动链式组合三级解析：
  // stub 匹配 → Taro 的 resolveRequest → 默认 context.resolveRequest。
  const emptyStub = path.resolve(__dirname, 'stubs', 'native-empty.js')
  // 传递依赖在纯 RN 工程无法 autolink；其顶层 requireNativeModule 在 Hermes 下必崩。
  // 按"包根名"匹配（含子路径，如 expo-modules-core/polyfill 与 expo-location/build/xx），
  // 全部重定向到惰性 Proxy 替身：任意属性访问/调用返回安全对象，顶层求值永不抛。
  const stubbedRoots = new Set([
    '@react-native-community/geolocation',
    '@react-native-community/netinfo',
    'expo-location',
    'expo-modules-core',
    'expo',
    'expo-av',
    'expo-barcode-scanner',
    'expo-brightness',
    'expo-camera',
    'expo-file-system',
    'expo-image-picker',
    'expo-keep-awake',
    'expo-sensors',
  ])
  function isStubbedModule (specifier) {
    const parts = specifier.split('/')
    const root = parts[0].charAt(0) === '@' ? parts.slice(0, 2).join('/') : parts[0]
    return stubbedRoots.has(root)
  }
  const finalConfig = mergeConfig({ resolver: {} }, taroConfig)
  const taroResolveRequest = finalConfig.resolver.resolveRequest

  finalConfig.resolver.resolveRequest = (context, moduleName, platform) => {
    if (isStubbedModule(moduleName)) {
      return { type: 'sourceFile', filePath: emptyStub }
    }
    if (taroResolveRequest) {
      return taroResolveRequest(context, moduleName, platform)
    }
    return context.resolveRequest(context, moduleName, platform)
  }

  return finalConfig
})()
