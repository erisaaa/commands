module.exports = {
  extends: "clarity/typescript",
  parserOptions: {
    project: "./tsconfig.json",
  },
  rules: {
    "import/prefer-default-export": "off",
  },
};
