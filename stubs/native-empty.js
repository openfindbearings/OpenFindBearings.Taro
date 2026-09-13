/**
 * Metro 打包层的原生模块惰性替身。
 * 背景：taro-rn 的定位链路 import 了多个无法 autolink 的传递依赖原生包
 * （@react-native-community/geolocation 是 @tarojs/taro-rn 的传递依赖，RN 0.70 autolink
 * 只处理 package.json 直接依赖；expo-location / expo-modules-core 等同理）。
 * 这些包的 JS 入口在模块顶层即执行 requireNativeModule / new NativeEventEmitter(Proxy)，
 * Hermes 下原生模块缺失会抛 LINKING_ERROR / 读 undefined 属性 TypeError，
 * 中断整个 bundle 求值 → AppRegistry 未注册 → app 白屏。
 * 本次改动：metro.config.js 的 resolveRequest 把上述包重定向到本文件。
 * 替身用惰性 Proxy 实现：任何属性访问 / 函数调用 / 构造都返回安全惰性对象，
 * 顶层求值永不抛错；项目业务代码完全未使用定位、相机、传感器等任何原生能力，
 * 即使将来误调用也只会得到 undefined 结果而非崩溃。
 */
function makeLazyStub (label) {
  const fn = function lazyStubCallable () {}
  const handler = {
    get (target, prop) {
      // ESM 命名空间标记：保持 false 走 interop 的 { default } 包装，避免被误判为真实模块
      if (prop === '__esModule') return false
      // 防止被 await 时误当成 thenable 挂起
      if (prop === 'then') return undefined
      if (prop === 'toString') return () => label
      if (prop === Symbol.toPrimitive) return () => undefined
      return makeLazyStub(label + '.' + String(prop))
    },
    apply () {
      return makeLazyStub(label + '()')
    },
    construct () {
      return {}
    },
    has () {
      return true
    },
  }
  return new Proxy(fn, handler)
}

module.exports = makeLazyStub('native-empty-stub')
