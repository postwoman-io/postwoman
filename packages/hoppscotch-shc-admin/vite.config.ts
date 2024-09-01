import { PluginOption, defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import { FileSystemIconLoader } from "unplugin-icons/loaders"
import Icons from "unplugin-icons/vite"
import Unfonts from "unplugin-fonts/vite"
import IconResolver from "unplugin-icons/resolver"
import Components from "unplugin-vue-components/vite"
import Pages from "vite-plugin-pages"
import Layouts from "vite-plugin-vue-layouts"
import path from "path"
import ImportMetaEnv from "@import-meta-env/unplugin"
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite"

// https://vitejs.dev/config/
export default defineConfig({
  envPrefix: process.env.HOPP_ALLOW_RUNTIME_ENV ? "VITE_BUILDTIME_" : "VITE_",
  envDir: path.resolve(__dirname, "../.."),
  server: {
    port: 3100,
  },
  publicDir: path.resolve(__dirname, "../hoppscotch-sh-admin/public"),
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "../hoppscotch-sh-admin/src"),
      "@modules": path.resolve(__dirname, "../hoppscotch-sh-admin/src/modules"),
      "@hoppscotch/common": "@hoppscotch/common/src",
      "@hoppscotch/sh-admin": path.resolve(
        __dirname,
        "../hoppscotch-sh-admin/src"
      ),
    },
  },
  plugins: [
    vue(),
    Pages({
      dirs: "../hoppscotch-sh-admin/src/pages",
      routeStyle: "nuxt",
    }),
    Layouts({
      defaultLayout: "default",
      layoutsDirs: "../hoppscotch-sh-admin/src/layouts",
    }),
    VueI18nPlugin({
      runtimeOnly: false,
      compositionOnly: true,
      include: [path.resolve(__dirname, "../hoppscotch-sh-admin/locales/**")],
    }) as unknown as PluginOption,
    Components({
      dts: "./src/components.d.ts",
      dirs: ["../hoppscotch-sh-admin/src/components"],
      directoryAsNamespace: true,
      resolvers: [
        IconResolver({
          prefix: "icon",
          customCollections: ["auth"],
        }),
        (compName: string) => {
          if (compName.startsWith("Hopp"))
            return { name: compName, from: "@hoppscotch/ui" }
          else return undefined
        },
      ],
      types: [
        {
          from: "vue-tippy",
          names: ["Tippy"],
        },
      ],
    }) as unknown as PluginOption,
    Icons({
      compiler: "vue3",
      customCollections: {
        auth: FileSystemIconLoader("../hoppscotch-sh-admin/assets/icons/auth"),
      },
    }) as unknown as PluginOption,
    Unfonts({
      fontsource: {
        families: [
          {
            name: "Inter Variable",
            variables: ["variable-full"],
          },
          {
            name: "Material Symbols Rounded Variable",
            variables: ["variable-full"],
          },
          {
            name: "Roboto Mono Variable",
            variables: ["variable-full"],
          },
        ],
      },
    }) as unknown as PluginOption,
    process.env.HOPP_ALLOW_RUNTIME_ENV
      ? (ImportMetaEnv.vite({
          example: "../../.env.example",
          env: "../../.env",
        }) as unknown as PluginOption)
      : ([] as PluginOption[]),
  ],
})
