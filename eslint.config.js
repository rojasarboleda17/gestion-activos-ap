import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const strictTypingRules = {
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-empty-object-type": "warn",
  "@typescript-eslint/no-require-imports": "warn",
};

const criticalModules = [
  "src/pages/admin/**/*.{ts,tsx}",
  "src/components/operations/**/*.{ts,tsx}",
  "src/components/vehicle/**/*.{ts,tsx}",
];

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Fase base (resto del código): mantener off para evitar bloqueos
      // mientras se migra por módulos críticos.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Fase 1 (actual): módulos críticos en "warn" para limpiar deuda sin romper CI.
    files: criticalModules,
    rules: strictTypingRules,
  },
  {
    // Fase 2 (siguiente PR): escalar a "error" en módulos críticos.
    // Fase 3 (criterio de salida): escalar a "error" a nivel global
    // cuando no haya regresiones de lint/build.
    files: ["**/*.{ts,tsx}"],
    rules: {},
  },
);
