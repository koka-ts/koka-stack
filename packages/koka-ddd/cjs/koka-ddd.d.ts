import { Ctx, AnyErr, Async, MaybePromise, Result, AnyEff } from 'koka'
import { Updater, Optic, OpticOptions, OpticErr, GetKey } from 'koka-optic'
export * from 'koka-optic'
export declare class Domain<State, Root> {
    $: Optic<State, Root>
    constructor(options: OpticOptions<State, Root>)
    getKey?: GetKey<State>
}
export type SetStateInput<S> = S | Updater<S> | ((state: S) => S)
export type GetRoot<Root> = Ctx<'getRoot', () => Root>
export type SetRoot<Root> = Ctx<'setRoot', (Root: Root) => void>
export type QueryEff<Root> = OpticErr | GetRoot<Root>
export type RootAccessor<Root> = GetRoot<Root> | SetRoot<Root>
export type CommandStack = {
    name: string
    async: boolean
    args: unknown[]
    return: unknown
    states: {
        previous: unknown
        next: unknown
    }[]
    stacks: CommandStack[]
}
export declare const prettyPrintCommandStack: (commandStack: CommandStack) => string
export type CommandStackEff = Ctx<'commandStack', CommandStack | undefined>
export type CommandEff<Root> = OpticErr | RootAccessor<Root> | CommandStackEff
export type StoreOptions<State> = {
    state: State
}
export type MaybeFunction<T> = T | (() => T)
export type DomainQuery<Return, Root, E extends AnyEff = never> = Generator<QueryEff<Root> | E, Return>
export type DomainCommand<Return, Root, E extends AnyEff = never> = Generator<CommandEff<Root> | E, Return>
export declare function get<State, Root>(
    domainOrOptic: Domain<State, Root> | Optic<State, Root>,
): DomainQuery<State, Root>
export declare function set<State, Root>(
    domainOrOptic: Domain<State, Root> | Optic<State, Root>,
    setStateInput: SetStateInput<State>,
): DomainCommand<void, Root>
type KokaClassMethodDecoratorContext<
    This = unknown,
    Value extends (this: This, ...args: any) => any = (this: This, ...args: any) => any,
> = ClassMethodDecoratorContext<This, Value> & {
    /**
     * The name of the method should be a string.
     */
    name: string
    /**
     * The static property should be false, which means that the method is an instance method.
     */
    static: false
}
export declare function query(): <This, Args extends any[], Root, Return, E extends AnyEff>(
    target: (this: This, ...args: Args) => Generator<Exclude<E, SetRoot<any>>, Return>,
    context: KokaClassMethodDecoratorContext<This, typeof target>,
) => typeof target
export declare function command(): <This, Args extends any[], Root, Return, E extends AnyEff>(
    target: (this: This, ...args: Args) => Generator<E | CommandEff<Root>, Return>,
    context: KokaClassMethodDecoratorContext<This, typeof target>,
) => typeof target
export type StoreContext = Record<string, unknown>
type ToCtxEff<T extends StoreContext> = {
    [K in keyof T]: K extends string ? Ctx<K, T[K]> : never
}[keyof T]
export declare class Store<State> {
    state: State
    context: StoreContext
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
    runQuery<T, E extends QueryEff<State> | AnyErr | Async | ToCtxEff<this['context']>>(
        input: MaybeFunction<Generator<Exclude<E, SetRoot<any>>, T>>,
    ): Async extends E ? MaybePromise<Result<T, E>> : Result<T, E>
    runCommand<T, E extends CommandEff<State> | AnyErr | Async | ToCtxEff<this['context']>>(
        input: MaybeFunction<Generator<E, T>>,
    ): Async extends E ? MaybePromise<Result<T, E>> : Result<T, E>
}
