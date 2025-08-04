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
    moduleNameMapper: {
        '^koka$': 'koka/src/koka.ts',
        '^koka/(.*)$': 'koka/src/$1.ts',
        '^koka-optic$': 'koka-optic/src/koka-optic.ts',
        '^koka-optic/(.*)$': 'koka-optic/src/$1.ts',
    },
    testPathIgnorePatterns: ['/node_modules/', '/examples/'],
    globals: {
        'ts-jest': {
            diagnostics: false,
        },
    },
    displayName: {
        name: 'koka-optic',
        color: 'blue',
    },
    collectCoverageFrom: ['src/**/*.{ts,tsx}'],
    rootDir: __dirname,
}
