module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  verbose: true,
  setupFiles: ['dotenv/config'],
  testMatch: ['**/tests/*.test.js'],
};