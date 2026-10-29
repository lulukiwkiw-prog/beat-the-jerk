import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'prototype', 'playwright-report', 'test-results', 'screenshots'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // 隱私與安全（SPEC 第 3 節）
      'no-console': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-properties': ['error',
        { property: 'innerHTML', message: '玩家輸入只能以純文字顯示（SPEC 第 3 節）' },
        { property: 'outerHTML', message: '玩家輸入只能以純文字顯示（SPEC 第 3 節）' },
        { property: 'insertAdjacentHTML', message: '玩家輸入只能以純文字顯示（SPEC 第 3 節）' },
      ],
      'no-restricted-syntax': ['error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: '禁止 dangerouslySetInnerHTML（SPEC 第 3 節）' },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
