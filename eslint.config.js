import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
export default tseslint.config({ ignores: ['dist', 'node_modules', 'studio/.qa', 'playwright-report', 'test-results', '**/*.test.mjs', '**/*.spec.ts'] },js.configs.recommended,...tseslint.configs.recommended,{files:['**/*.{ts,tsx}'],languageOptions:{globals:{...globals.browser,...globals.node}},plugins:{'react-hooks':hooks},rules:{...hooks.configs.recommended.rules,'@typescript-eslint/no-explicit-any':'error'}},{files:['**/*.mjs'],languageOptions:{globals:globals.node}});
