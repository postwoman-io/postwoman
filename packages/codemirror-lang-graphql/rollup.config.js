import typescript from "@rollup/plugin-typescript"
import { lezer } from "@lezer/generator/rollup"

export default {
  input: "src/index.js",
  external: (id) => id != "tslib" && !/^(\.?\/|\w:)/.test(id),
  output: [
    { file: "dist/index.cjs", format: "cjs" },
    { dir: "./dist", format: "es" },
  ],
  plugins: [
    lezer(),
    typescript({
      tsconfig: "./tsconfig.json"
    })
  ],
}
