module.exports = {
    verbose: true,
    collectCoverage: true,
    coverageThreshold: {
        global: {
            // TODO: Adjust expectation once I have real tests:
            branches: 70,
            lines: 85
        }
    },
    coveragePathIgnorePatterns: [
        './src/retry-async.*',
        './test/db/index.*'
    ],
    roots: [
        './test',
    ],
    testMatch: [
        '**/?(*.)+(spec|test).+(ts|tsx|js)',
        '**/__tests__/**/*.+(ts|tsx|js)'
    ],
    transform: {
        '^.+\\.(ts|tsx)$': [
            'ts-jest',
            {
                tsconfig: {
                    target: 'ES2022',
                    esModuleInterop: true
                }
            }
        ]
    }
}
