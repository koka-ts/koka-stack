# Design Document

## Overview

This design outlines the extraction of message passing functionality from the main koka.ts file into a separate msg.ts module. The refactoring will improve code organization, enable better tree-shaking, and create a cleaner separation of concerns between core effect system functionality and message passing capabilities.

## Architecture

### Current State

-   All functionality is in a single `packages/koka/src/koka.ts` file
-   Message passing types, classes, and functions are mixed with core effect system code
-   All exports are available from the main koka entry point

### Target State

-   Core effect system remains in `packages/koka/src/koka.ts`
-   Message passing functionality moves to `packages/koka/src/msg.ts`
-   Message passing functionality is accessible via `koka/msg` subpath export
-   Package.json exports field configured for proper subpath resolution

## Components and Interfaces

### Code to Extract from koka.ts

#### Types and Interfaces

```typescript
// Message-related types
export type Msg<Name extends string, T>
export type AnyMsg
export interface SendMsg<Name extends string, T>
export interface WaitMsg<Name extends string, T>
export interface Wait<T extends AbstractMsg<any>>
export type MsgValue<M extends AnyMsg>

// Message extraction utility type
type ExtractMsgMessage<T>
```

#### Classes and Functions

```typescript
// Abstract base class for messages
abstract class AbstractMsg<T>

// Message class factory function
export function Msg<const Name extends string>(name: Name)

// Message passing functions
export function* send<T extends SendMsg<string, unknown>>(message: T)
export function* wait<MsgCtor extends typeof AbstractMsg<unknown>>(msg: MsgCtor)
export function* communicate<const T extends {}>(inputs: T)
```

### Dependencies Analysis

#### msg.ts Dependencies

The msg.ts module will need to import the following from koka.ts:

-   `EffSymbol` and `EffSymbol` type
-   `AnyEff` type
-   `isGenerator` function
-   `of` function
-   `cleanUpGen` utility (needs to be exported from koka.ts)
-   Type utilities: `ExtractYield`, `ExtractReturn`, `Task`

#### Updated EffType

The `EffType<T>` union type in koka.ts will need to be updated to exclude `Msg<string, T>` since messages will be handled separately.

### Module Structure

#### packages/koka/src/msg.ts

```typescript
// Imports from koka.ts
import { EffSymbol, AnyEff, isGenerator, of /* other dependencies */ } from './koka.js'

// Message-specific types and implementations
export type Msg<Name extends string, T> = {
    /* ... */
}
// ... other message types

export function Msg<const Name extends string>(name: Name) {
    /* ... */
}
export function* send<T extends SendMsg<string, unknown>>(message: T) {
    /* ... */
}
export function* wait<MsgCtor extends typeof AbstractMsg<unknown>>(msg: MsgCtor) {
    /* ... */
}
export function* communicate<const T extends {}>(inputs: T) {
    /* ... */
}
```

#### packages/koka/src/koka.ts (updated)

```typescript
// Remove all Msg-related code
// Update EffType to exclude Msg
export type EffType<T> = Err<string, T> | Ctx<string, T> | Opt<string, T> | Async

// Export utilities needed by msg.ts
export { cleanUpGen } // Make this public
```

#### packages/koka/package.json (updated)

```json
{
    "exports": {
        ".": {
            "import": "./esm/index.js",
            "require": "./cjs/index.js",
            "types": "./cjs/index.d.ts"
        },
        "./msg": {
            "import": "./esm/msg.js",
            "require": "./cjs/msg.js",
            "types": "./cjs/msg.d.ts"
        }
    }
}
```

## Data Models

### Message Types Hierarchy

```
AbstractMsg<T> (abstract base class)
├── Msg<Name, T> (concrete implementation via factory function)
├── SendMsg<Name, T> (interface extending Msg)
├── WaitMsg<Name, T> (interface extending Msg)
└── Wait<T> (interface for waiting operations)
```

### Type Relationships

-   `AnyMsg` = `Msg<string, any>`
-   `MsgValue<M>` extracts the message payload type
-   `ExtractMsgMessage<T>` utility for type extraction in wait operations

## Error Handling

### Import/Export Errors

-   Circular dependency prevention through careful import structure
-   Clear error messages if msg.ts utilities are used without proper imports

### Runtime Errors

-   Maintain existing error handling in communicate function
-   Preserve error messages for unmatched send/wait operations
-   Ensure cleanup functions work correctly across module boundaries

## Testing Strategy

### Test File Organization

-   Move all communicate/Msg related tests from `koka.test.ts` to `msg.test.ts`
-   Ensure test imports use the new `koka/msg` subpath
-   Maintain test coverage for all extracted functionality

### Test Categories to Move

1. `Eff.communicate` tests
2. `Eff.send` and `Eff.wait` tests
3. Message class creation tests
4. Complex message passing scenarios
5. Error handling in message operations

### Integration Testing

-   Verify that msg.ts works correctly with core koka functionality
-   Test that subpath exports work in both CJS and ESM builds
-   Validate tree-shaking behavior with bundlers

## Implementation Considerations

### Build System Updates

-   Ensure TypeScript compilation includes msg.ts in both CJS and ESM builds
-   Update build scripts if necessary to handle new file structure
-   Verify that type definitions are generated correctly for subpath exports

### Backward Compatibility

-   This is a breaking change requiring users to update imports
-   Document migration path: `import { Msg } from 'koka'` → `import { Msg } from 'koka/msg'`
-   Consider providing migration guide in documentation

### Performance Impact

-   Improved tree-shaking: users not using message passing won't bundle that code
-   Slightly increased complexity in import resolution
-   No runtime performance impact expected

## Migration Path

### For Library Users

```typescript
// Before
import { Msg, communicate, send, wait } from 'koka'

// After
import { Msg, communicate, send, wait } from 'koka/msg'
```

### For Library Maintainers

1. Extract code to msg.ts
2. Update package.json exports
3. Update internal imports
4. Move and update tests
5. Update documentation and examples
