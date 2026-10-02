import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          print: resolve('src/renderer/print.html'),
          preview: resolve('src/renderer/preview.html'),
          sel: resolve('src/renderer/sel.html')
        }
      }
    }
  }
})
