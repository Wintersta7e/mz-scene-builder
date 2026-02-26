module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/__tests__/**/*.test.mjs'],
  collectCoverageFrom: ['src/modules/**/*.js', 'src/lib/**/*.js'],
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/node_modules/'],
  transform: {},
  verbose: true
};
