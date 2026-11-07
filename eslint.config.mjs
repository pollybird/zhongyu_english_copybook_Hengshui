import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: [
      'dist/**',
      'out/**',
      'node_modules/**',
      'resources/**',
      '.screenshots/**',
      '.trae-html-share-packages/**'
    ]
  },
  js.configs.recommended,
  {
    files: [
      'src/main/**/*.js',
      'src/preload/**/*.js',
      'scripts/**/*.mjs',
      'electron.vite.config.mjs'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },
  {
    files: ['src/renderer/**/*.js', 'src/shared/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node }
    }
  },
  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  }
]
