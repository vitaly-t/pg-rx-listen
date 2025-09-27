module.exports = {
    verbose: true,
    collectCoverage: true,
    coverageThreshold: {
        global: {
            // TODO: Adjust expectation once I have real tests:
            branches: 45,
            lines: 65
        }
    },
    coveragePathIgnorePatterns: [
        './src/retry-async.ts',
        './test/db/index.ts'
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
