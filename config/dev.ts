import type { UserConfigExport } from '@tarojs/cli'

export default {
  logger: {
    quiet: false,
    stats: true,
  },
  mini: {},
  h5: {
    server: {
      host: '0.0.0.0',
      port: 10087,
      proxy: {
        // BFF 代理（H5 跨域）
        '/mobile': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        // Identity OAuth 端点代理
        '/connect': {
          target: 'https://auth.abcsxl.com',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  },
} satisfies UserConfigExport
