# Implementation Plan

-   [x] 1. Prepare koka.ts for extraction by exposing internal utilities

    -   Export the `cleanUpGen` utility function that will be needed by msg.ts
    -   Update type definitions to prepare for Msg type removal
    -   _Requirements: 1.1, 4.1_

-   [ ] 2. Create msg.ts module with extracted message functionality

    -   Create new `packages/koka/src/msg.ts` file
    -   Move all Msg-related types from koka.ts to msg.ts

    -   Move AbstractMsg class and Msg factory function to msg.ts
    -   _Requirements: 1.1, 1.4, 4.4_

-   [ ] 3. Implement message passing functions in msg.ts

    -   Move `send` function from koka.ts to msg.ts
    -   Move `wait` function from koka.ts to msg.ts
    -   Move `communicate` function from koka.ts to msg.ts
    -   Add necessary imports from koka.ts
    -   _Requirements: 1.1, 1.4, 4.1_

-   [ ] 4. Update koka.ts to remove message functionality

    -   Remove all Msg-related types from koka.ts

    -   Remove AbstractMsg class and Msg factory function from koka.ts
    -   Remove send, wait, and communicate functions from koka.ts
    -   Update EffType union to exclude Msg types
    -   _Requirements: 1.1, 1.2, 4.2_

-   [ ] 5. Configure package.json for subpath exports

    -   Add exports field to package.json with koka/msg subpath
    -   Configure both CJS and ESM export paths for msg module
    -   Ensure TypeScript types are properly exported for subpath
    -   _Requirements: 1.3, 3.4_

-   [x] 6. Create msg.test.ts with extracted tests

    -   Create new `packages/koka/__tests__/msg.test.ts` file
    -   Move all communicate/Msg related tests from koka.test.ts to msg.test.ts
    -   Update test imports to use `koka/msg` subpath
    -   _Requirements: 2.1, 2.3_

-   [ ] 7. Update koka.test.ts to remove message tests

    -   Remove all communicate/Msg related test cases from koka.test.ts
    -   Remove message-related imports and test utilities
    -   Ensure remaining tests still pass
    -   _Requirements: 2.2, 2.4_

-   [ ] 8. Verify build system compatibility

    -   Run TypeScript compilation for both CJS and ESM builds
    -   Verify that msg.js and msg.d.ts files are generated correctly
    -   Test that subpath imports work in both module systems
    -   _Requirements: 3.4, 4.3_

-   [ ] 9. Run comprehensive test suite

    -   Execute all tests to ensure no regressions
    -   Verify that msg.test.ts runs correctly with new imports
    -   Confirm that koka.test.ts passes without message tests
    -   Test integration between core koka and msg modules
    -   _Requirements: 2.2, 3.3_

-   [ ] 10. Validate tree-shaking and module separation

    -   Test that importing only core koka doesn't include message code
    -   Verify that importing koka/msg works independently
    -   Confirm no circular dependencies exist between modules
    -   _Requirements: 3.4, 4.3_
