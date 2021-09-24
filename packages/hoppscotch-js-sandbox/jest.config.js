export default {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  setupFilesAfterEnv: ['./jest.setup.ts'],
}
