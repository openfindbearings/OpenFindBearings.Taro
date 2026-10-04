// 改动说明：版本号单一来源——package.json 的 version 注入为编译期常量 __APP_VERSION__，
// H5/小程序运行时直接读该常量；RN 端另走 android/app/build.gradle 同源读取 + DeviceInfo 运行时获取。
// 发布流程只需改 package.json 一处（git tag 与其保持一致）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs')

// 改动说明（pro 扩展缝）：@ofb/taro-pro 在开源/自用构建间切换——
// 自用构建（TARO_BUILD_PRO=1，且已安装/link 真包）解析到 node_modules 下的真包源码；
// 开源构建解析到 src/ext/pro.ts 占位（空实现），保证公开 fork 无私有依赖也能编译。
// 私有包源码由 mini/h5 的 webpackChain 追加 babel include 放行（RN 端后续单独验证）。
const usePro = process.env.TARO_BUILD_PRO === '1'
const proAlias = usePro
  ? {
      // 改动说明：pro 包 junction 解析为真实路径后 import（如 lucide-react）找不到主仓 node_modules，
      // 用 alias 精确指到主仓 lucide 包（不动 resolve.modules，避免破坏 .pnpm 内部解析）
      '@ofb/taro-pro': path.join(__dirname, '../node_modules/@ofb/taro-pro/src/index.ts'),
      'lucide-react': path.join(__dirname, '../node_modules/lucide-react'),
      'lucide-react-native': path.join(__dirname, '../node_modules/lucide-react-native')
    }
  : { '@ofb/taro-pro': path.join(__dirname, '../src/ext/pro.tsx') }
// webpack 默认把 node_modules 下的 link/junction 解析为真实路径，babel include 需同时命中真实目录
const proRealPath = usePro
  ? path.dirname(fs.realpathSync(require.resolve('@ofb/taro-pro/package.json')))
  : ''

const config = {
  projectName: 'openfindbearings',
  date: '2026-9-3',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  alias: proAlias,
  defineConstants: {
    // 编译期全局常量：当前应用版本号（SemVer，如 1.0.0-rc.1），供版本更新检查上报用
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  // 改动说明（weapp 登录报 "process is not defined"）：源码用 process.env.TARO_APP_* 读
  //   BFF/媒体地址，但项目无 .env 未定义这两个键 → 编译期不替换，小程序运行时没有
  //   process 全局，取 base 地址即抛错（H5/RN 有 process 垫片故从未暴露）。
  //   Taro 的 env 节专用于替换 process.env.X（defineConstants 不参与该前缀），
  //   缺省空串让业务代码 `|| 常量兜底` 生效；构建时可用同名 shell 环境变量覆盖
  env: {
    TARO_APP_BFF_BASE_URL: JSON.stringify(process.env.TARO_APP_BFF_BASE_URL || ''),
    TARO_APP_MEDIA_BASE_URL: JSON.stringify(process.env.TARO_APP_MEDIA_BASE_URL || '')
  },
  copy: {
    patterns: [
      { from: 'static', to: 'dist/static' }
    ],
    options: {
    }
  },
  framework: 'react',
  compiler: 'webpack5',
  cache: {
    enable: false // Webpack 持久化缓存配置，建议开启。默认配置请参考：https://docs.taro.zone/docs/config-detail#cache
  },
  mini: {
    // 改动说明（pro 扩展缝）：自用构建时放行 @ofb/taro-pro 源码（默认 babel 不处理 node_modules，
    // pro 包 TSX 会 ModuleParseError）——独立 rule include 该路径，loader 复用项目根 babel.config.js
    webpackChain(chain) {
      if (usePro) {
        // 改动说明：ofb-pro 规则级 resolve 只对 pro 包生效——pro 包 junction 解析为真实路径后，
        // 其 import（@tarojs/*、react、lucide-react 等）从 pro 包目录向上找不到主仓 node_modules，
        // 用 rule 级 modules 补齐主仓 node_modules（不影响全局解析，避免破坏 .pnpm 内部依赖查找）
        chain.module
          .rule('ofb-pro')
          .test(/\.(t|j)sx?$/)
          .include.add(path.join(__dirname, '../node_modules/@ofb/taro-pro'))
          .add(proRealPath)
          .end()
          .resolve.modules.add(path.join(__dirname, '../node_modules'))
          .end()
          .end()
          .use('babel')
          .loader(require.resolve('babel-loader'))
      }
    },
    postcss: {
      pxtransform: {
        enable: true,
        config: {
          // 改动说明：weapp 端 SCSS Npx 与 RN dp / H5 px 对齐（与 rn 段同款开关）。
          // 原沿用全局 deviceRatio{750:1} → Npx→Nrpx→屏宽375时 N/2 pt，
          // 而内联样式数字（Icon size、安全区 padding）不经 pxtransform 保持原值，
          // 导致 TabBar 栏高砍半、搜索按钮"圆底小图标大"比例倒挂。
          // 750:2 使 Npx→2Nrpx→Npt，三端度量语义统一
          deviceRatio: { 750: 2 }
        }
      },
      url: {
        enable: true,
        config: {
          limit: 1024 // 设定转换尺寸上限
        }
      },
      cssModules: {
        enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
        config: {
          namingPattern: 'module', // 转换模式，取值为 global/module
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    }
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    // 改动说明（pro 扩展缝）：同 mini——自用构建放行 @ofb/taro-pro 源码编译
    webpackChain(chain) {
      if (usePro) {
        // 改动说明：ofb-pro 规则级 resolve 只对 pro 包生效——pro 包 junction 解析为真实路径后，
        // 其 import（@tarojs/*、react、lucide-react 等）从 pro 包目录向上找不到主仓 node_modules，
        // 用 rule 级 modules 补齐主仓 node_modules（不影响全局解析，避免破坏 .pnpm 内部依赖查找）
        chain.module
          .rule('ofb-pro')
          .test(/\.(t|j)sx?$/)
          .include.add(path.join(__dirname, '../node_modules/@ofb/taro-pro'))
          .add(proRealPath)
          .end()
          .resolve.modules.add(path.join(__dirname, '../node_modules'))
          .end()
          .end()
          .use('babel')
          .loader(require.resolve('babel-loader'))
      }
    },
    postcss: {
      // 改动说明：H5 关闭 pxtransform 的 rem 缩放，px 保持字面值 1:1，
      // 与 RN 的 dp 语义（scalable:false + deviceRatio{750:2}）同值，
      // 使同一份 SCSS 在 H5 与 RN 渲染比例一致，避免 H5 布局被放大错乱。
      pxtransform: {
        enable: false
      },
      autoprefixer: {
        enable: true,
        config: {
        }
      },
      cssModules: {
        enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
        config: {
          namingPattern: 'module', // 转换模式，取值为 global/module
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    }
  },
  rn: {
    appName: 'openfindbearings',
    entry: 'app',
    output: {
      ios: './ios/main.jsbundle',
      iosAssetsDest: './ios',
      android: './android/app/src/main/assets/index.android.bundle',
      androidAssetsDest: './android/app/src/main/res',
      // iosSourceMapUrl: '',
      iosSourcemapOutput: './ios/main.map',
      // iosSourcemapSourcesRoot: '',
      // androidSourceMapUrl: '',
      androidSourcemapOutput: './android/app/src/main/assets/index.android.map',
      // androidSourcemapSourcesRoot: '',
    },
    postcss: {
      // v1.7.0 度量重构双开关之一：px→PX→纯数值，RN 端不再运行时缩放（scalePx2dp）
      scalable: false,
      // v1.7.0 度量重构双开关之二：rootValue=(1/deviceRatio[750])×2=1，
      // 抵消 postcss-pxtransform 在 rn 平台的默认 px 减半，使 SCSS 写 Npx = RN N dp
      pxtransform: {
        enable: true,
        config: {
          deviceRatio: { 750: 2 }
        }
      },
      cssModules: {
        enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
      }
    }
  }
}

module.exports = function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'))
  }
  return merge({}, config, require('./prod'))
}
