# Koka-Stack - AI-Oriented TypeScript Framework

**Warning: This library is in early development and may change significantly. Do not use in production yet.**

Koka-Stack is a monorepo containing several packages that provide algebraic effects and domain-driven development capabilities for TypeScript applications.

## Packages

### [koka](packages/koka/) - Core Effects Library

[GitHub Repo](https://github.com/koka-ts/koka)

A lightweight 3kB alternative to Effect-TS based on Algebraic Effects

-   Typed error handling
-   Context management
-   Async operations
-   Minimal API surface

### [koka-optic](packages/koka-optic) - Data Accessors

[GitHub Repo](https://github.com/koka-ts/koka-optic)

Bidirectional data accessors with optics based on `koka`

-   Type-safe data transformations
-   Lens/prism support
-   Effectful data operations
-   Composable access patterns

### [koka-ddd](packages/koka-ddd/) - DDD Framework

[GitHub Repo](https://github.com/koka-ts/koka-ddd)

An AI-Oriented Domain-Driven Design framework built on `koka` and `koka-optic`

-   Follows DDD principles
-   Optics integration
-   CQRS patterns

## Documentation

-   [Koka Core Documentation](packages/koka/README.md)
-   [Koka DDD Documentation](packages/koka-ddd/README.md)
-   [Koka Optic Documentation](packages/koka-optic/README.md)

## Contributing

We welcome contributions! Please see our [Contribution Guidelines](CONTRIBUTING.md).

## License

MIT
