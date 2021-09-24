module.exports = {
  root: true,
  env: {
    node: true,
    jest: true,
    browser: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    sourceType: "module",
    requireConfigFile: false,
    ecmaVersion: 2021,
  },
  plugins: ["prettier"],
  extends: [
    "prettier/prettier",
    "eslint:recommended",
    "plugin:prettier/recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    semi: [2, "never"],
    "prettier/prettier": ["warn", { semi: false }],
    "import/no-named-as-default": "off",
    "no-undef": "off",
    "@typescript-eslint/no-explicit-any": "off",
  },
}
