// ESLint 9 flat config — Next.js (core-web-vitals)
const { FlatCompat } = require('@eslint/eslintrc')
const path = require('path')

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'medical-platform-fixed/**',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
]
