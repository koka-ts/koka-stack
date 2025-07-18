module.exports = {
    transform: {
        '.(ts|tsx)': 'ts-jest',
    },
    testRegex: '(/__tests__/*.|\\.(test|spec))\\.(ts|tsx|js|jsx)$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    coveragePathIgnorePatterns: ['/example/', '/node_modules/', '/__tests__/'],
    coverageThreshold: {
        global: {
            branches: 90,
            functions: 95,
            lines: 95,
            statements: 95,
        },
    },
    collectCoverageFrom: ['./src/**/*.{ts,tsx}'],
    rootDir: __dirname,
    testEnvironment: 'jsdom',
    moduleNameMapper: {},
    testPathIgnorePatterns: ['/node_modules/', '/examples/'],
    globals: {
        'ts-jest': {
            diagnostics: false,
        },
    },
    displayName: {
        name: 'koka',
        color: 'purple',
    },
    collectCoverageFrom: ['src/**/*.{ts,tsx}'],
    rootDir: __dirname,
}
