module.exports = {
  root: true,
  extends: ['@react-native/eslint-config'],
  rules: {
    'no-console': 'off',
    'prettier/prettier': 'off',
    'curly': 'off',
    'no-undef-init': 'off',
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
  }
};
