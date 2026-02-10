import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const strictTypingRules = {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-empty-object-type": "error",
  "@typescript-eslint/no-require-imports": "error",
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
    // Puerta de entrada a "P1 cerrado": estos módulos críticos ya escalan a "error".
    // El resto del código mantiene "off" temporalmente para completar migración gradual.
    files: criticalModules,
    rules: strictTypingRules,
  },
  {
    // Siguiente hito tras "P1 cerrado": escalar a "error" a nivel global
    // cuando no haya regresiones de lint/build.
    files: ["**/*.{ts,tsx}"],
    rules: {},
  },
);
