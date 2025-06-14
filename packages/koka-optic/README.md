# koka-optic - Get/Set Immutable Data Made Easy

**Warning: This library is in early development and may change significantly. Do not use in production yet.**

koka-optic makes working with immutable data structures effortless, providing a simple and type-safe way to:

-   **Get** deeply nested values
-   **Set** values without mutating original data
-   **Transform** complex data structures with ease

Built on composable optics with full TypeScript type safety and seamless Koka effects integration.

## Motivation

Working with immutable data in JavaScript/TypeScript often leads to verbose code like:

```typescript
const newState = {
    ...state,
    user: {
        ...state.user,
        profile: {
            ...state.user.profile,
            name: 'New Name',
        },
    },
}
```

koka-optic simplifies this to:

```typescript
const nameOptic = Optic.root<User>().prop('user').prop('profile').prop('name')

const updateName = Optic.set(state, nameOptic, 'New Name')

const result = Eff.runResult(updateName) // { user: { profile: { name: 'New Name' } } }
```

### Why koka-optic?

-   🚀 **Simpler immutable updates** - No more spread operator hell
-   🔍 **Type-safe access** - Catch errors at compile time
-   🧩 **Composable operations** - Build complex transformations from simple parts
-   ⚡ **Performance optimized** - Automatic caching for repeated accesses

## Features

-   **Effortless immutable updates**: Modify nested data without mutation
-   **Type-safe accessors**: Compile-time checking for all operations
-   **Composable API**: Chain operations naturally
-   **Smart caching**: Optimized performance for repeated accesses
-   **Koka integration**: Works seamlessly with effects system

## Installation

```bash
npm install koka-optic
# or
yarn add koka-optic
# or
pnpm add koka-optic
```

## Getting Started

### Core Concepts

An **Optic** is a bidirectional path into your data structure that lets you:

1. **Get** values (like a getter)
2. **Set** values (like a setter)
3. **Transform** values (like a mapper)

All while preserving immutability and type safety.

```typescript
import { Optic } from 'koka-optic'

// Create root optic
const root = Optic.root<number>()

// Create object property optic
const nameOptic = Optic.root<{ name: string }>().prop('name')

// Create array index optic
const firstItemOptic = Optic.root<number[]>().index(0)
```

## Basic Usage

### Getting Values

```typescript
const valueResult = Eff.runResult(Optic.get({ name: 'Alice' }, nameOptic))
if (valueResult.type === 'ok') {
    const value = valueResult.value // 'Alice'
}

const firstResult = Eff.runResult(Optic.get([1, 2, 3], firstItemOptic))
if (firstResult.type === 'ok') {
    const first = firstResult.value // 1
}
```

### Setting Values

```typescript
// Set with value
const updatedResult = Eff.runResult(Optic.set({ name: 'Alice' }, nameOptic, 'Bob'))
if (updatedResult.type === 'ok') {
    const updated = updatedResult.value // {name: 'Bob'}
}

// Set with updater function
const incrementedResult = Eff.runResult(Optic.set([1, 2, 3], firstItemOptic, (n) => n + 1))
if (incrementedResult.type === 'ok') {
    const incremented = incrementedResult.value // [2, 2, 3]
}
```

## Advanced Optics

### Object Composition

```typescript
const userOptic = Optic.object({
    name: Optic.root<User>().prop('name'),
    age: Optic.root<User>().prop('age'),
})

const user = {
    name: 'Alice',
    age: 30,
    email: 'alice@example.com',
}

const result = Eff.runResult(Optic.get(user, userOptic))
if (result.type === 'ok') {
    const value = result.value // {name: 'Alice', age: 30}
}
```

### Array Operations

```typescript
// Find item
const foundResult = Eff.runResult(
    Optic.get(
        [1, 2, 3, 4],
        Optic.root<number[]>().find((n) => n > 2),
    ),
)
if (foundResult.type === 'ok') {
    const found = foundResult.value // 3
}

// Filter items
const filteredResult = Eff.runResult(
    Optic.get(
        [1, 2, 3, 4],
        Optic.root<number[]>().filter((n) => n % 2 === 0),
    ),
)
if (filteredResult.type === 'ok') {
    const filtered = filteredResult.value // [2, 4]
}

// Map items
const mappedResult = Eff.runResult(
    Optic.get(
        [1, 2, 3],
        Optic.root<number[]>().map((n) => n * 2),
    ),
)
if (mappedResult.type === 'ok') {
    const mapped = mappedResult.value // [2, 4, 6]
}
```

### Type Narrowing and Value Validation

#### Type Narrowing with `match`

```typescript
const numberOptic = Optic.root<string | number>().match((v): v is number => typeof v === 'number')

const numberResult = Eff.runResult(Optic.get(42, numberOptic))
if (numberResult.type === 'ok') {
    const value = numberResult.value // 42
}

const stringResult = Eff.runResult(Optic.get('test', numberOptic))
if (stringResult.type === 'err') {
    // throws OpticErr
}
```

#### Value Validation with `refine`

```typescript
const refinedOptic = Optic.root<number>().refine((n) => n > 0)

const positiveResult = Eff.runResult(Optic.get(42, refinedOptic))

if (positiveResult.type === 'ok') {
    const value = positiveResult.value // 42
}

const negativeResult = Eff.runResult(Optic.get(-1, refinedOptic))

if (negativeResult.type === 'err') {
    // throws OpticErr
}
```

## Caching Behavior

koka-optic automatically caches optic computations for better performance:

```typescript
const user = { name: 'Alice', age: 30 }
const nameOptic = Optic.root<User>().prop('name')

// First access - computes and caches
const name1Result = Eff.runResult(Optic.get(user, nameOptic))
const name2Result = Eff.runResult(Optic.get(user, nameOptic))

if (name1Result.type === 'ok' && name2Result.type === 'ok') {
    const name1 = name1Result.value
    const name2 = name2Result.value
    name1 === name2 // true
}
```

Caching works for all optic types including:

-   Object properties
-   Array indices
-   Find operations
-   Filter operations
-   Map operations
-   Type refinements

## Error Handling

All operations can throw `OpticErr`:

```typescript
const result = Eff.runResult(Optic.get([], Optic.root<number[]>().index(0)))
if (result.type === 'err') {
    console.error('Optic error:', result.error.message)
}
```

Common error cases:

-   Accessing non-existent array indices
-   Failed find/filter operations
-   Type refinement failures
-   Invalid updates

## API Reference

### Static Methods

| Method                                   | Description                  |
| ---------------------------------------- | ---------------------------- |
| `Optic.root<T>()`                        | Create root optic for type T |
| `Optic.object(fields)`                   | Compose object optics        |
| `Optic.optional(optic)`                  | Create optional optic        |
| `Optic.get(root, optic)`                 | Get value through optic      |
| `Optic.set(root, optic, valueOrUpdater)` | Set value through optic      |

### Instance Methods

| Method              | Description            |
| ------------------- | ---------------------- |
| `prop(key)`         | Access object property |
| `index(n)`          | Access array index     |
| `find(predicate)`   | Find array item        |
| `filter(predicate)` | Filter array           |
| `map(transform)`    | Transform values       |
| `match(predicate)`  | Type narrow            |
| `refine(predicate)` | Value validation       |
| `select(selector)`  | Custom selector        |

## Best Practices

1. **Compose optics** to build complex data access patterns
2. **Reuse optics** to benefit from caching
3. **Combine with effects** for async operations
4. **Handle errors** for robust code
5. **Leverage TypeScript** for maximum type safety

## Examples

See the [test cases](packages/koka-optic/__tests__/koka-optic.test.ts) for more comprehensive usage examples.

## License

MIT

## Contributing

Contributions are welcome!
