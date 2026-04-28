import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'

const copySplashAssetsPlugin = () => {
  return {
    name: 'copy-splash-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/assets/icon.png') {
          const iconPath = resolve(__dirname, 'assets/icon.png')
          if (fs.existsSync(iconPath)) {
            const content = fs.readFileSync(iconPath)
            res.setHeader('Content-Type', 'image/png')
            res.end(content)
            return
          }
        }
        next()
      })
    },
    closeBundle() {
      const outRenderer = resolve(__dirname, 'out/renderer')
      const outAssets = resolve(outRenderer, 'assets')
      
      if (!fs.existsSync(outAssets)) {
        fs.mkdirSync(outAssets, { recursive: true })
      }
      
      const iconSrc = resolve(__dirname, 'assets/icon.png')
      if (fs.existsSync(iconSrc)) {
        fs.copyFileSync(iconSrc, resolve(outAssets, 'icon.png'))
        console.log('Copied assets/icon.png to out/renderer/assets/icon.png')
      }
    }
  }
}

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.js')
        },
        external: ['electron', 'electron-log', 'electron-updater', 'fs', 'path', 'child_process', 'crypto', 'stream', 'events', 'util', 'os', 'mysql2']
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.js')
        },
        external: ['electron']
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [vue(), copySplashAssetsPlugin()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        '@assets': resolve(__dirname, 'assets')
      }
    },
    base: '/',
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name].[ext]',
          manualChunks: {
            'codemirror': ['@codemirror/view', '@codemirror/state', '@codemirror/language', '@codemirror/lang-sql', '@codemirror/autocomplete', '@codemirror/theme-one-dark', 'codemirror']
          }
        }
      }
    }
  }
})