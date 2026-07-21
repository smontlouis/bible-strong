import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist", "node_modules", "outputs", "viewer/app"]
  },
  {
    rules: {
      "no-console": "off"
    }
  }
);
