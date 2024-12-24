import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Icons from 'unplugin-icons/vite';
import IconResolver from 'unplugin-icons/resolver';
import Components from 'unplugin-vue-components/vite';
import path from 'path';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
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
            return { name: compName, from: '@hoppscotch/ui' };
          else return undefined;
        },
      ],
      types: [
        {
          from: 'vue-tippy',
          names: ['Tippy'],
        },
      ],
    }),
    Icons({
      compiler: 'vue3',
    }),
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
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
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
