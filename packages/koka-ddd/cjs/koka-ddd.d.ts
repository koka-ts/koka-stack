import { Ctx, AnyErr, Async, MaybePromise, Result } from 'koka'
import { Updater, Optic, OpticOptions, OpticErr } from 'koka-optic'
export * from 'koka-optic'
export declare class Domain<State, Root> {
    $: Optic<State, Root>
    constructor(options: OpticOptions<State, Root>)
}
export type SetStateInput<S> = S | Updater<S> | ((state: S) => S)
export type GetRoot<Root> = Ctx<'getRoot', () => Root>
export type SetRoot<Root> = Ctx<'setRoot', (Root: Root) => void>
export type RootAccessor<Root> = GetRoot<Root> | SetRoot<Root>
export type StoreOptions<State> = {
    state: State
}
export type MaybeFunction<T> = T | (() => T)
export type DomainQuery<Return, Root, E extends AnyErr = never> = Generator<OpticErr | GetRoot<Root> | E, Return>
export type DomainCommand<Return, Root, E extends AnyErr = never> = Generator<OpticErr | RootAccessor<Root> | E, Return>
export declare function get<State, Root>(
    domainOrOptic: Domain<State, Root> | Optic<State, Root>,
): DomainQuery<State, Root>
export declare function set<State, Root>(
    domainOrOptic: Domain<State, Root> | Optic<State, Root>,
    setStateInput: SetStateInput<State>,
): DomainCommand<void, Root>
export declare class Store<State> {
    state: State
    constructor(options: StoreOptions<State>)
    getState: () => State
    private dirty
    setState: (state: State) => void
    pid: number
    private listeners
    subscribe(listener: (state: State) => void): () => void
    publish(): void
    get<T>(domainOrOptic: Optic<T, State> | Domain<T, State>): Result<T, OpticErr>
    set<T>(domainOrOptic: Optic<T, State> | Domain<T, State>, input: SetStateInput<T>): Result<void, OpticErr>
    runQuery<T, E extends OpticErr | GetRoot<State> | AnyErr | Async>(
        input: MaybeFunction<Generator<E, T>>,
    ): Async extends E ? MaybePromise<Result<T, E>> : Result<T, E>
    runCommand<T, E extends OpticErr | RootAccessor<State> | AnyErr | Async>(
        input: MaybeFunction<Generator<E, T>>,
    ): Async extends E ? MaybePromise<Result<T, E>> : Result<T, E>
}
