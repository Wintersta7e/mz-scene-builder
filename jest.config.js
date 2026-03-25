module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/__tests__/**/*.test.mjs'],
  collectCoverageFrom: ['src/modules/**/*.js', 'src/lib/**/*.js'],
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/node_modules/'],
  transform: {},
  verbose: true,
  coverageThreshold: {
    // Per-file thresholds on tested modules — prevent regression
    './src/lib/mz-converter.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './src/modules/event-bus.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './src/modules/utils.js': {
      branches: 90,
      functions: 100,
      lines: 100,
      statements: 100
    }
  }
};
