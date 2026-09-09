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
  defineConstants: {
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
    postcss: {
      pxtransform: {
        enable: true,
        config: {

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
