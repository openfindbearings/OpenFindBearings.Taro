class WriteVirtualFilePlugin {
  apply(compiler) {
    compiler.hooks.afterEnvironment.tap('WriteVirtualFilePlugin', () => {
      let fs = compiler.inputFileSystem
      while (fs && fs._inputFileSystem) {
        fs = fs._inputFileSystem
      }
      if (fs && !fs._writeVirtualFile) {
        fs._writeVirtualFile = (file, stats, contents) => {
          fs._virtualFiles = fs._virtualFiles || {}
          fs._virtualFiles[file] = { stats, contents }
        }
      }
    })
  }
}

module.exports = {
  env: {
    NODE_ENV: '"development"'
  },
  defineConstants: {},
  mini: {},
  h5: {
    cache: false,
    enableExtract: false,
    webpackChain(chain) {
      chain.plugin('writeVirtualFile').use(WriteVirtualFilePlugin)
    },
    devServer: {
      proxy: {
        // 开发代理默认指向本地 BFF（launchSettings 的 http://localhost:16020）；
        // 开源脱敏：不再内置测试服务器域名，连别的环境时按需改 target
        '/mobile': {
          target: 'http://localhost:16020',
          changeOrigin: true,
          secure: false
        },
        // 媒体源独立于 BFF：/media 由媒体服务器直出；本地无媒体服务时 404 走占位图降级
        '/media': {
          target: 'http://localhost:16020',
          changeOrigin: true,
          secure: false
        }
      }
    }
  }
}
