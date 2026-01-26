import { type Config } from "prettier";

const config: Config = {
  "plugins": ["prettier-plugin-organize-imports"],
  "singleQuote": false,
  "trailingComma": "es5",
  "endOfLine": "lf",
  "semi": true,
  "tabWidth": 2,
  "printWidth": 80,
  "arrowParens": "always",
  "overrides": [
    {
      "files": "exports.ts",
      "options": {
        "printWidth": 1000
      }
    },
    {
      "files": "**/translations/**.json",
      "options": {
        "printWidth": 1000
      }
    }
  ]
}

export default config;