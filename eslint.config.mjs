// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig } from "eslint/config";
import nextConfig from "eslint-config-next";

export default defineConfig([{
  extends: [nextConfig],
  rules: {
    "@next/next/no-html-link-for-pages": "off",
  },
}, {
  ignores: ["node_modules/", ".next/", "coverage/", "e2e/", "storybook-static/", ".storybook/"],
}, ...storybook.configs["flat/recommended"]]);
