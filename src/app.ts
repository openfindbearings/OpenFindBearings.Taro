import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { useAuthStore } from './stores/authStore'
import './app.scss'

function App({ children }: PropsWithChildren) {
  const init = useAuthStore((s) => s.init)

  useLaunch(() => {
    init()
  })

  return children
}

export default App
