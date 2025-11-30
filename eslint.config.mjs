import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  // Next.js recommended rules
  ...nextVitals,
  ...nextTs,

  // Our project-specific rules
  {
    rules: {
      // Still visible, but no longer blocks CI / `npm run check`
      "@typescript-eslint/no-explicit-any": "warn",

      // Allow "_" prefix for intentionally unused variables / args
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },

  // Override / extend default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Extra ignores for legacy / backup files
    "app/api/admin/credit-lots/import-invoice/routeBACKUP123.ts",
    "lib/api/admin/old/**",
  ]),
]);

export default eslintConfig;
