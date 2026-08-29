import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/.legacy-local/**",
      "**/.local/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/outputs/**",
      "**/viewer/app/**"
    ]
  },
  {
    files: ["workflows/commentaries/scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node
    },
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "no-empty": ["error", { "allowEmptyCatch": true }]
    }
  },
  {
    files: ["workflows/commentaries/app.js"],
    languageOptions: {
      globals: globals.browser
    }
  },
  {
    rules: {
      "no-console": "off"
    }
  }
);
