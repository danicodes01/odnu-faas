const path = require('path');

module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: path.resolve(__dirname, './tsconfig.json'),
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", 
    "/generated/**/*", 
    ".eslintrc.js", 
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
    "indent": ["error", 2],
    "object-curly-spacing": [
      "error",
      "always",
      { "objectsInObjects": false, "arraysInObjects": false },
    ],
  },
};
