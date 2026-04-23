const js = require('@eslint/js')
const vuePlugin = require('eslint-plugin-vue')

module.exports = [
  js.configs.recommended,
  ...vuePlugin.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        FileReader: 'readonly',
        crypto: 'readonly',
        NodeFilter: 'readonly',
        FormData: 'readonly',
        HTMLElement: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        // Node.js globals
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        Buffer: 'readonly',
        // Electron globals
        electron: 'readonly'
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-reserved-component-names': 'off',
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-debugger': 'off',
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'semi': ['warn', 'never'],
      'comma-dangle': ['warn', 'never'],
      'eqeqeq': ['warn', 'always', { null: 'ignore' }],
      'no-multiple-empty-lines': ['warn', { max: 1, maxEOF: 1 }],
      'prefer-const': 'warn',
      'no-var': 'warn',
      'indent': ['warn', 2, { SwitchCase: 1 }]
    }
  },
  {
    ignores: [
      'out/**',
      'dist/**',
      'node_modules/**',
      '*.js'
    ]
  }
]