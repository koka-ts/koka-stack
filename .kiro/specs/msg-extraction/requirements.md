# Requirements Document

## Introduction

This feature involves extracting all communicate/Msg related code from the main koka.ts file into a separate msg.ts module to improve code organization and maintainability. The goal is to make the main koka.ts file more focused and modular by separating message passing functionality into its own dedicated module.

## Requirements

### Requirement 1

**User Story:** As a developer working with the koka library, I want the message passing functionality to be in a separate module, so that the main koka.ts file is more focused and easier to navigate.

#### Acceptance Criteria

1. WHEN I examine the koka.ts file THEN all Msg-related types, classes, and functions SHALL be moved to msg.ts
2. WHEN I examine the koka.ts file THEN all communicate-related functions SHALL be moved to msg.ts
3. WHEN I import from koka/msg THEN the Msg and communicate functionality SHALL be available as a subpath export
4. WHEN I examine the msg.ts file THEN it SHALL contain all message passing related code in a self-contained module

### Requirement 2

**User Story:** As a developer running tests, I want the message passing tests to be in a separate test file, so that test organization matches the code organization.

#### Acceptance Criteria

1. WHEN I examine the koka.test.ts file THEN all communicate/Msg related test cases SHALL be moved to msg.test.ts
2. WHEN I run the test suite THEN all existing tests SHALL continue to pass
3. WHEN I examine the msg.test.ts file THEN it SHALL contain comprehensive tests for message passing functionality
4. WHEN I examine the koka.test.ts file THEN it SHALL no longer contain message passing related tests

### Requirement 3

**User Story:** As a developer using the koka library, I want to access message passing functionality via a subpath import, so that I can benefit from better tree-shaking and more explicit imports.

#### Acceptance Criteria

1. WHEN I import Msg classes from koka/msg THEN they SHALL work exactly as before
2. WHEN I import the communicate function from koka/msg THEN it SHALL work exactly as before
3. WHEN I use message passing functionality THEN the behavior SHALL be identical to before the refactoring
4. WHEN I examine the subpath exports THEN koka/msg SHALL be properly configured for tree-shaking

### Requirement 4

**User Story:** As a developer maintaining the codebase, I want proper module dependencies and imports, so that the code structure is clean and maintainable.

#### Acceptance Criteria

1. WHEN I examine msg.ts THEN it SHALL only import necessary dependencies from koka.ts
2. WHEN I examine koka.ts THEN it SHALL NOT re-export Msg functionality (accessed via koka/msg subpath instead)
3. WHEN I examine the import structure THEN there SHALL be no circular dependencies
4. WHEN I examine the modules THEN each SHALL have a clear, single responsibility
