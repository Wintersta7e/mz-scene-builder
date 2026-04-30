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
      // --- Existing (tightened) ---
      'no-var': 'error',
      eqeqeq: 'error',
      'prefer-const': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      'no-console': 'warn',

      // --- New: correctness ---
      curly: 'error',
      'no-throw-literal': 'error',
      'no-shadow': 'error',
      'no-return-assign': 'error',
      'no-param-reassign': 'warn',
      'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      'no-implicit-coercion': 'error',
      radix: 'error',

      // --- New: style / clarity ---
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'no-else-return': 'error'
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

  // Main-process modules (orchestration + IPC handlers)
  {
    files: ['src/main/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs'
    }
  },

  // Renderer modules (contextIsolation: true — browser globals only, window.api from preload)
  {
    files: ['src/renderer.js', 'src/modules/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser
      },
      sourceType: 'module'
    }
  },

  // Logger and event-bus — console is their purpose
  {
    files: ['src/modules/logger.js', 'src/modules/event-bus.js', 'src/lib/main-logger.js'],
    rules: {
      'no-console': 'off'
    }
  },

  // Tests (CJS)
  {
    files: ['__tests__/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      sourceType: 'commonjs'
    }
  },

  // Tests (ESM) — some tests set up globalThis.document for DOM-dependent modules
  {
    files: ['__tests__/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest, document: 'writable' },
      sourceType: 'module'
    }
  },

  // Config files
  {
    files: ['*.config.js', '*.config.mjs'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },

  // Dev scripts (profiling harness, fetch-fonts shim, etc.) — Node, not renderer.
  {
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'module'
    },
    rules: {
      'no-console': 'off'
    }
  },

  // Prettier compat — must be last
  prettierConfig
];
