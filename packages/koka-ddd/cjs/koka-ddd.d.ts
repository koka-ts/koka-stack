import { Ctx, AnyErr, Async, MaybePromise, Result, AnyEff } from 'koka'
import { Updater, Optic, OpticOptions, OpticErr, GetKey } from 'koka-optic'
export * from 'koka-optic'
export declare class Domain<State, Root> {
    $: Optic<State, Root>
    constructor(options: OpticOptions<State, Root>)
    getKey?: GetKey<State>
}
export type SetStateInput<S> = S | Updater<S> | ((state: S) => S)
declare const GetRoot_base: any
export declare class GetRoot<Root> extends GetRoot_base<() => Root> {}
declare const SetRoot_base: any
export declare class SetRoot<Root> extends SetRoot_base<(Root: Root) => void> {}
export type QueryEff<Root> = OpticErr | GetRoot<Root> | ExecutionTreeOpt
export type RootAccessor<Root> = GetRoot<Root> | SetRoot<Root>
export type ExecutionTree = CommandExecutionTree | QueryExecutionTree
export type StateChange = {
    previous: unknown
    next: unknown
}
export type CommandExecutionTree = {
    type: 'command'
    name: string
    async: boolean
    args: unknown[]
    return: unknown
    states: unknown[]
    changes: StateChange[]
    commands: CommandExecutionTree[]
    queries: QueryExecutionTree[]
}
export type QueryExecutionTree = {
    type: 'query'
    async: boolean
    name: string
    args: unknown[]
    return: unknown
    states: unknown[]
    queries: QueryExecutionTree[]
}
declare const ExecutionTreeOpt_base: any
export declare class ExecutionTreeOpt extends ExecutionTreeOpt_base<ExecutionTree> {}
export type CommandEff<Root> = OpticErr | RootAccessor<Root> | ExecutionTreeOpt
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
) => (this: This, ...args: Args) => Generator<Exclude<E, SetRoot<any>> | ExecutionTreeOpt | QueryEff<Root>, Return>
export declare function command(): <This, Args extends any[], Root, Return, E extends AnyEff>(
    target: (this: This, ...args: Args) => Generator<E | CommandEff<Root>, Return>,
    context: KokaClassMethodDecoratorContext<This, typeof target>,
) => typeof target
export type StoreContext = Record<string, unknown>
type ToCtxEff<T extends StoreContext> = {
    [K in keyof T]: K extends string ? Ctx<K, T[K]> : never
}[keyof T]
export type StoreEnhancer<State> = (store: Store<State>) => void
export type StoreOptions<State> = {
    state: State
    enhancers?: StoreEnhancer<State>[]
}
export declare class Store<State> {
    state: State
    context: StoreContext
    enhancers: StoreEnhancer<State>[]
    constructor(options: StoreOptions<State>)
    getState: () => State
    private dirty
    setState: (state: State) => void
    pid: number
    private listeners
    subscribe(listener: (state: State) => unknown): () => void
    publish(): void
    private executionListeners
    subscribeExecution(listener: (tree: ExecutionTree) => unknown): () => void
    private publishExecution
    get<T>(domainOrOptic: Optic<T, State> | Domain<T, State>): Result<T, OpticErr>
    set<T>(domainOrOptic: Optic<T, State> | Domain<T, State>, input: SetStateInput<T>): Result<void, OpticErr>
    runQuery<T, E extends QueryEff<State> | AnyErr | Async | ToCtxEff<this['context']>>(
        input: MaybeFunction<Generator<Exclude<E, SetRoot<any>>, T>>,
    ): Async extends E ? MaybePromise<Result<T, E>> : Result<T, E>
    runCommand<T, E extends CommandEff<State> | AnyErr | Async | ToCtxEff<this['context']>>(
        input: MaybeFunction<Generator<E, T>>,
    ): Async extends E ? MaybePromise<Result<T, E>> : Result<T, E>
}
