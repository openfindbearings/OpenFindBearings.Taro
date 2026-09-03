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
        '/mobile': {
          target: 'https://bff.515813.xyz',
          changeOrigin: true,
          secure: false
        }
      }
    }
  }
}
