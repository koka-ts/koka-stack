export type Err<Name extends string, T> = {
    type: 'err'
    name: Name
    error: T
}

export type AnyErr = Err<string, any>

export function Err<const Name extends string>(name: Name) {
    return class Eff<E = void> {
        static field: Name = name
        type = 'err' as const
        name = name
        error: E
        constructor(error: E) {
            this.error = error
        }
    }
}

function* throwError<E extends AnyErr>(err: E): Generator<E, never> {
    yield err
    /* istanbul ignore next */
    throw new Error(`Unexpected resumption of error effect [${err.name}]`)
}

export { throwError as throw }
