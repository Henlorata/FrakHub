import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import {defineConfig, globalIgnores} from "eslint/config";

export default defineConfig([
  globalIgnores([
    "dist",
    "coverage",
    "playwright-report",
    "test-results",
    "blob-report",
    ".e2e-dist",
    "supabase/.temp",
    "src/types/database.types.ts",
  ]),

  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true},
      ],
      // Legacy code relies on `any` heavily; keep it visible without blocking the build.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Browser code (React).
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat["recommended-latest"]],
    languageOptions: {globals: globals.browser},
    rules: {
      // React Compiler oriented rules: reported as warnings until the remaining
      // legacy components are migrated, so they do not block CI on day one.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },

  // Node code: serverless functions, shared helpers, tooling and tests.
  {
    files: ["api/**/*.ts", "shared/**/*.ts", "tooling/**/*.ts", "e2e/**/*.ts", "*.config.{js,ts}"],
    languageOptions: {globals: globals.node},
  },
]);
