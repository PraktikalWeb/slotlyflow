import eslint from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const webSourceFiles = ["apps/web/**/*.{js,jsx,mjs,ts,tsx,mts,cts}"];
const webNextConfig = {
  ...nextPlugin.configs["core-web-vitals"],
  files: webSourceFiles,
};
const webReactHooksConfig = {
  ...reactHooks.configs.flat.recommended,
  files: webSourceFiles,
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/next-env.d.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  webNextConfig,
  webReactHooksConfig,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error"
    }
  }
);
