'use strict';

module.exports = [
  {
    // Generated artifact: minified output is not meant to be read or edited.
    // npm run build regenerates it; test/atvImg.test.js fails if it drifts from
    // the source.
    ignores: ['atvImg-min.js', 'coverage/**', 'node_modules/**']
  },
  {
    // The plug-in is deliberately ES5 with no build step required to use it.
    // Keep it that way: atvImg.js is loaded directly by <script> tags.
    files: ['atvImg.js'],
    languageOptions: {
      ecmaVersion: 5,
      sourceType: 'script',
      globals: {
        document: 'readonly',
        window: 'readonly',
        // Used only by atvImgWarn() to report rejected data-img values.
        console: 'readonly',
        // Only touched behind a `typeof module` guard for CommonJS consumers.
        module: 'readonly'
      }
    },
    rules: {
      // `caughtErrors: 'none'` is required, not stylistic: atvImg.js is ES5, so
      // optional catch binding (`catch {`) is not available and an ES5 catch is
      // always a named binding.
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-undef': 'error',
      eqeqeq: ['error', 'allow-null']
    }
  },
  {
    // Tests and tooling may use modern syntax; they never ship to a browser.
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'commonjs',
      globals: {
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
        jest: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        // DOM constructors jsdom provides.
        Event: 'readonly',
        MouseEvent: 'readonly',
        CSSStyleDeclaration: 'readonly',
        setTimeout: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none' }],
      'no-undef': 'error',
      eqeqeq: ['error', 'allow-null'],
      'no-var': 'error',
      'prefer-const': 'error'
    }
  }
];
