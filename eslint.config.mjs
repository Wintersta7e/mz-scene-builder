import js from '@eslint/js';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier/flat';

export default [
  // Global ignores
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', 'inspections/', 'assets/', 'docs/']
  },

  // Base recommended rules for all JS files
  js.configs.recommended,

  // Shared rule overrides for all files
  {
    rules: {
      'no-var': 'error',
      eqeqeq: 'error',
      'prefer-const': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'warn'
    }
  },

  // Node main process: main.js
  {
    files: ['main.js'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs'
    }
  },

  // preload.js — runs in Electron's renderer context (has window + Node)
  {
    files: ['preload.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      sourceType: 'commonjs'
    },
    rules: {
      'no-console': 'off'
    }
  },

  // Shared lib (pure functions, used by both processes)
  {
    files: ['src/lib/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs'
    }
  },

  // Renderer modules (nodeIntegration: true — has both browser + Node globals)
  {
    files: ['src/renderer.js', 'src/modules/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        // Electron preload-exposed API
        api: 'readonly'
      },
      sourceType: 'commonjs'
    }
  },

  // Logger and event-bus — console is their purpose
  {
    files: ['src/modules/logger.js', 'src/modules/event-bus.js'],
    rules: {
      'no-console': 'off'
    }
  },

  // Tests
  {
    files: ['__tests__/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      sourceType: 'commonjs'
    }
  },

  // Config files
  {
    files: ['*.config.js', '*.config.mjs'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },

  // Prettier compat — must be last
  prettierConfig
];
