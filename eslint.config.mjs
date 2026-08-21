import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "template/**"]),
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    ignores: ["src/generated/**"],
    rules: {
      "max-lines": ["error", { max: 900, skipBlankLines: true, skipComments: true }],
    },
  },
]);
