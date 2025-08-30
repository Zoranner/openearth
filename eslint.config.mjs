// @ts-check
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';

export default [
  // 基础 JavaScript 推荐配置
  js.configs.recommended,
  
  // 全局配置
  {
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: eslintPluginPrettier,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 基础代码质量规则
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': 'off', // 由 TypeScript 处理
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'prefer-arrow-callback': 'error',
      'no-duplicate-imports': 'error',
      'no-undef': 'off', // TypeScript 处理
      
      // Prettier 集成
      'prettier/prettier': 'error',
      
      // 禁用与 prettier 冲突的规则
      ...eslintConfigPrettier.rules,
    },
  },
  
  // TypeScript 特定规则
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'none',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
    },
  },
  
  // 测试文件特定规则
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  
  // 示例文件特定规则
  {
    files: ['**/examples/**/*.ts', '**/examples/**/*.js'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  
  // 全局忽略配置
  {
    ignores: [
      // 构建输出
      'dist/**',
      'build/**',
      '.output/**',
      '.cache/**',
      
      // 依赖目录
      'node_modules/**',
      
      // TypeScript 编译输出
      '**/*.tsbuildinfo',
      '.tscache/**',
      
      // Vite 相关
      '.vite/**',
      'vite.config.*.timestamp-*',
      
      // 测试覆盖率
      'coverage/**',
      '.nyc_output/**',
      
      // 日志文件
      'logs/**',
      '*.log',
      
      // 编辑器和 IDE
      '.vscode/**',
      '.idea/**',
      '.claude/**',
      '.cursor/**',
      
      // 临时文件
      'tmp/**',
      'temp/**',
      
      // 压缩文件
      '**/*.min.js',
      '**/*.min.css',
      
      // 参考文件
      'refs/**',
      
      // 示例 HTML 文件
      'examples/**/*.html',
      
      // 生成的类型定义（可选）
      // '**/*.d.ts',
    ],
  },
];
