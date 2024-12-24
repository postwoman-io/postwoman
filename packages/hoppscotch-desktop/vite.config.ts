import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import Icons from 'unplugin-icons/vite'
import IconResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'
import path from 'path'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST

export default defineConfig(async () => ({
  plugins: [
    vue(),
    Components({
      dts: './src/components.d.ts',
      resolvers: [
        IconResolver({
          prefix: 'icon',
        }),
        (compName: string) => {
          if (compName.startsWith('Hopp'))
            return { name: compName, from: '@hoppscotch/ui' }
          return undefined
        },
      ],
      types: [
        {
          from: 'vue-tippy',
          names: ['Tippy'],
        },
      ],
      include: [/\.vue$/, /\.vue\?vue/],
      dirs: ['src/components'],
    }),
    Icons({
      compiler: 'vue3',
    }),
  ],

  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
      "~/": path.resolve(__dirname, "src/"),
    },
    dedupe: ["vue"],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}))
