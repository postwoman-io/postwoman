import { defineConfig, loadEnv, normalizePath } from "vite"
import { APP_INFO, META_TAGS } from "./meta"
import { viteStaticCopy as StaticCopy } from "vite-plugin-static-copy"
import generateSitemap from "vite-plugin-pages-sitemap"
import HtmlConfig from "vite-plugin-html-config"
import Vue from "@vitejs/plugin-vue"
import VueI18n from "@intlify/vite-plugin-vue-i18n"
import Components from "unplugin-vue-components/vite"
import Icons from "unplugin-icons/vite"
import Inspect from "vite-plugin-inspect"
import { VitePWA } from "vite-plugin-pwa"
import Pages from "vite-plugin-pages"
import Layouts from "vite-plugin-vue-layouts"
import IconResolver from "unplugin-icons/resolver"
import { FileSystemIconLoader } from "unplugin-icons/loaders"
import * as path from "path"
import Unfonts from "unplugin-fonts/vite"
import legacy from "@vitejs/plugin-legacy"
import ImportMetaEnv from "@import-meta-env/unplugin"

const ENV = loadEnv("development", path.resolve(__dirname, "../../"), ["VITE_"])

export default defineConfig({
  envPrefix: process.env.HOPP_ALLOW_RUNTIME_ENV ? "VITE_BUILDTIME_" : "VITE_",
  envDir: path.resolve(__dirname, "../../"),
  // TODO: Migrate @hoppscotch/data to full ESM
  define: {
    // For 'util' polyfill required by dep of '@apidevtools/swagger-parser'
    "process.env": {},
  },
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
  publicDir: path.resolve(__dirname, "../hoppscotch-common/public"),
  build: {
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      maxParallelFileOps: 2,
    },
  },
  resolve: {
    alias: {
      "tailwind.config.cjs": path.resolve(
        __dirname,
        "../hoppscotch-common/tailwind.config.cjs"
      ),
      "postcss.config.cjs": path.resolve(
        __dirname,
        "../hoppscotch-common/postcss.config.cjs"
      ),
      // TODO: Maybe leave ~ only for individual apps and not use on common
      "~": path.resolve(__dirname, "../hoppscotch-common/src"),
      "@hoppscotch/common": "@hoppscotch/common/src",
      "@composables": path.resolve(
        __dirname,
        "../hoppscotch-common/src/composables"
      ),
      "@modules": path.resolve(__dirname, "../hoppscotch-common/src/modules"),
      "@components": path.resolve(
        __dirname,
        "../hoppscotch-common/src/components"
      ),
      "@helpers": path.resolve(__dirname, "../hoppscotch-common/src/helpers"),
      "@functional": path.resolve(
        __dirname,
        "../hoppscotch-common/src/helpers/functional"
      ),
      "@workers": path.resolve(__dirname, "../hoppscotch-common/src/workers"),
      "@platform": path.resolve(__dirname, "./src/platform"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      stream: "stream-browserify",
      util: "util",
      querystring: "qs",
    },
    dedupe: ["vue"],
  },
  plugins: [
    Inspect(), // go to url -> /__inspect
    HtmlConfig({
      metas: META_TAGS(ENV),
    }),
    Vue(),
    Pages({
      routeStyle: "nuxt",
      dirs: "../hoppscotch-common/src/pages",
      importMode: "async",
      onRoutesGenerated(routes) {
        generateSitemap({
          routes,
          nuxtStyle: true,
          allowRobots: true,
          dest: ".sitemap-gen",
          hostname: ENV.VITE_BASE_URL,
        })
      },
    }),
    StaticCopy({
      targets: [
        {
          src: normalizePath(path.resolve(__dirname, "./.sitemap-gen/*")),
          dest: normalizePath(path.resolve(__dirname, "./dist")),
        },
      ],
    }),
    Layouts({
      layoutsDirs: "../hoppscotch-common/src/layouts",
      defaultLayout: "default",
    }),
    VueI18n({
      runtimeOnly: false,
      compositionOnly: true,
      include: [path.resolve(__dirname, "locales")],
    }),
    Components({
      dts: "../hoppscotch-common/src/components.d.ts",
      dirs: ["../hoppscotch-common/src/components"],
      directoryAsNamespace: true,
      resolvers: [
        IconResolver({
          prefix: "icon",
          customCollections: ["hopp", "auth", "brands"],
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
    }),
    Icons({
      compiler: "vue3",
      customCollections: {
        hopp: FileSystemIconLoader("../hoppscotch-common/assets/icons"),
        auth: FileSystemIconLoader("../hoppscotch-common/assets/icons/auth"),
        brands: FileSystemIconLoader(
          "../hoppscotch-common/assets/icons/brands"
        ),
      },
    }),
    VitePWA({
      useCredentials: true,
      manifest: {
        name: APP_INFO.name,
        short_name: APP_INFO.name,
        description: APP_INFO.shortDescription,
        start_url: "/?source=pwa",
        id: "/?source=pwa",
        protocol_handlers: [
          {
            protocol: "web+hoppscotch",
            url: "/%s",
          },
          {
            protocol: "web+hopp",
            url: "/%s",
          },
        ],
        background_color: APP_INFO.app.background,
        theme_color: APP_INFO.app.background,
        icons: [
          {
            src: "/icons/pwa-16x16.png",
            sizes: "16x16",
            type: "image/png",
          },
          {
            src: "/icons/pwa-32x32.png",
            sizes: "32x32",
            type: "image/png",
          },
          {
            src: "/icons/pwa-128x128.png",
            sizes: "128x128",
            type: "image/png",
          },
          {
            src: "/icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/pwa-256x256.png",
            sizes: "256x256",
            type: "image/png",
          },
          {
            src: "/icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/pwa-1024x1024.png",
            sizes: "1024x1024",
            type: "image/png",
          },
        ],
      },
      registerType: "prompt",
      workbox: {
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 10485760,
        navigateFallbackDenylist: [
          /robots.txt/,
          /sitemap.xml/,
          /discord/,
          /telegram/,
          /beta/,
          /careers/,
          /newsletter/,
          /twitter/,
          /github/,
          /announcements/,
          /admin/,
          /backend/,
        ],
      },
    }),
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
    }),
    legacy({
      modernPolyfills: ["es.string.replace-all"],
      renderLegacyChunks: false,
    }),
    process.env.HOPP_ALLOW_RUNTIME_ENV
      ? ImportMetaEnv.vite({
          example: "../../.env.example",
          env: "../../.env",
        })
      : [],
  ],
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern",
      },
    },
  },
})
