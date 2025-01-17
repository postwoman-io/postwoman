import { resolve } from "path"
import { defineConfig } from "vite"

export default defineConfig({
  build: {
    outDir: "./dist",
    emptyOutDir: true,
    lib: {
      entry: {
        'hoppscotch-kernel': resolve(__dirname, 'src/index.ts'),
      },
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: [
        '@tauri-apps/api',
        '@tauri-apps/plugin-dialog',
        '@tauri-apps/plugin-fs',
        '@tauri-apps/plugin-shell',
        'tauri-plugin-relay-api',
        'axios',
        'fp-ts'
      ]
    }
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
      '@io': resolve(__dirname, './src/io'),
      '@relay': resolve(__dirname, './src/relay'),
      '@store': resolve(__dirname, './src/store'),
      '@type': resolve(__dirname, './src/type'),
      '@util': resolve(__dirname, './src/util')
    }
  }
})
