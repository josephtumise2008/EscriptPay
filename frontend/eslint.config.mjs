import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  {
    ignores: [".next/**", "node_modules/**", "out/**"],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "off",
      "react/no-unescaped-entities": "off",
      // React Compiler's opinionated rule; standard mount-time data fetching
      // and route-change state resets are intentional in this codebase.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);