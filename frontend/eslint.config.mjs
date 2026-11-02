import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["*.config.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts"]),
]);
