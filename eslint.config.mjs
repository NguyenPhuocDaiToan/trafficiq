import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Skill ui-ux-pro-max & co. là code vendored (cài bằng ui-ux-pro-max-cli).
    // Không phải source của dự án nên không áp rule của dự án lên nó — các file
    // .cjs trong đó dùng require() và sẽ fail @typescript-eslint/no-require-imports.
    ".claude/skills/**",
  ]),
]);

export default eslintConfig;
