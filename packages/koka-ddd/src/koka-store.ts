import * as Koka from 'koka'
import * as Result from 'koka/result'
import * as Err from 'koka/err'
import * as Opt from 'koka/opt'
import * as Ctx from 'koka/ctx'
import * as Async from 'koka/async'
import * as Optic from 'koka-optic'

export class Domain<State, Root> {
    [Optic.OPTICAL]: Optic.Optic<State, Root>

    constructor(optic: Optic.Optic<State, Root>) {
        this[Optic.OPTICAL] = optic

        Object.defineProperty(this[Optic.OPTICAL], 'getKey', {
            get: () => this.getKey,
        })
    }

    getKey?: Optic.GetKey<State>
}

export type SetStateInput<S> = S | Optic.Updater<S> | ((state: S) => S)

export class GetRoot<Root> extends Ctx.Ctx('koka-store/get-root')<() => Root> {}

export class SetRoot<Root> extends Ctx.Ctx('koka-store/set-root')<(Root: Root) => void> {}

export type QueryEff<Root> = Optic.OpticErr | GetRoot<Root> | ExecutionTreeOpt

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

export class ExecutionTreeOpt extends Opt.Opt('koka-store/execution-tree')<ExecutionTree> {}

export type CommandEff<Root> = Optic.OpticErr | RootAccessor<Root> | ExecutionTreeOpt

export type MaybeFunction<T> = T | (() => T)

export type DomainQuery<Return, Root, E extends Koka.AnyEff = never> = Generator<QueryEff<Root> | E, Return>

export type DomainCommand<Return, Root, E extends Koka.AnyEff = never> = Generator<CommandEff<Root> | E, Return>

export function* get<State, Root>(
    domainOrOptic: Domain<State, Root> | Optic.Optic<State, Root>,
): DomainQuery<State, Root> {
    const optic = domainOrOptic instanceof Domain ? Optic.from(domainOrOptic) : domainOrOptic

    const executionTree = yield* Opt.get(ExecutionTreeOpt)

    const getRoot = yield* Ctx.get(GetRoot<Root>)

    const root = getRoot()

    const state = yield* optic.get(root)

    executionTree?.states.push(state)

    return state
}

export function* set<State, Root>(
    domainOrOptic: Domain<State, Root> | Optic.Optic<State, Root>,
    setStateInput: SetStateInput<State>,
): DomainCommand<void, Root> {
    const optic = domainOrOptic instanceof Domain ? Optic.from(domainOrOptic) : domainOrOptic

    const executionTree = yield* Opt.get(ExecutionTreeOpt)

    const updateRoot = optic.set(function* (state) {
        if (typeof setStateInput !== 'function') {
            if (executionTree?.type === 'command') {
                executionTree.changes.push({
                    previous: state,
                    next: setStateInput,
                })
            }
            return setStateInput
        }

        const result = (setStateInput as Optic.Updater<State> | ((state: State) => State))(state)

        const nextState = yield* Optic.getOpticValue(result)

        if (executionTree?.type === 'command') {
            executionTree.changes.push({
                previous: state,
                next: nextState,
            })
        }

        return nextState
    })

    const getRoot = yield* Ctx.get(GetRoot<Root>)

    const root = getRoot()

    const newRoot = yield* updateRoot(root)

    const setRoot = yield* Ctx.get(SetRoot<Root>)

    setRoot(newRoot)
}

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

export function query() {
    return function <This, Args extends any[], Root, Return, E extends Koka.AnyEff>(
        target: (this: This, ...args: Args) => Generator<Exclude<E, SetRoot<any>>, Return>,
        context: KokaClassMethodDecoratorContext<This, typeof target>,
    ): (this: This, ...args: Args) => Generator<Exclude<E, SetRoot<any>> | ExecutionTreeOpt | QueryEff<Root>, Return> {
        const methodName = context.name

        function* replacementMethod(
            this: This,
            ...args: Args
        ): Generator<Exclude<E, SetRoot<any>> | ExecutionTreeOpt | QueryEff<Root>, Return> {
            const parent: ExecutionTree | undefined = yield* Opt.get(ExecutionTreeOpt)

            const name = `${(this as any).constructor?.name ?? 'UnknownDomain'}.${methodName}`
            const executionTree: QueryExecutionTree = {
                type: 'query',
                async: false,
                name,
                args: args,
                return: undefined,
                states: [],
                queries: [],
            }

            if (parent) {
                parent.queries.push(executionTree)
            }

            const gen = Koka.try(target.call(this, ...args)).handle({
                [ExecutionTreeOpt.field]: executionTree,
            } as any)

            let result = gen.next()

            while (!result.done) {
                const effect = result.value

                if (effect.type === 'async') {
                    executionTree.async = true
                    result = gen.next(yield effect)
                } else {
                    result = gen.next(yield effect)
                }
            }

            executionTree.return = result.value

            return result.value as Return
        }

        return replacementMethod
    }
}

export function command() {
    return function <This, Args extends any[], Root, Return, E extends Koka.AnyEff>(
        target: (this: This, ...args: Args) => Generator<E | CommandEff<Root>, Return>,
        context: KokaClassMethodDecoratorContext<This, typeof target>,
    ): typeof target {
        const methodName = context.name

        function* replacementMethod(this: This, ...args: Args): Generator<any, Return, unknown> {
            const parent: ExecutionTree | undefined = yield* Opt.get(ExecutionTreeOpt)

            const name = `${(this as any).constructor?.name ?? 'UnknownDomain'}.${methodName}`
            const executionTree: CommandExecutionTree = {
                type: 'command',
                async: false,
                name,
                args: args,
                return: undefined,
                states: [],
                changes: [],
                commands: [],
                queries: [],
            }

            if (parent?.type === 'command') {
                parent.commands.push(executionTree)
            }

            const gen = Koka.try(target.call(this, ...args)).handle({
                [ExecutionTreeOpt.field]: executionTree,
            } as any)

            let result = gen.next()

            while (!result.done) {
                const effect = result.value

                if (effect.type === 'async') {
                    executionTree.async = true
                    result = gen.next(yield effect as any)
                } else {
                    result = gen.next(yield effect as any)
                }
            }

            executionTree.return = result.value

            return result.value as Return
        }

        return replacementMethod
    }
}

export type ToCtxEff<T> = {
    [K in keyof T]: K extends string ? Ctx.Ctx<K, T[K]> : never
}[keyof T]

export type StoreEnhancer<Root, Context extends StoreContext> = (store: Store<Root, Context>) => (() => void) | void

export type StoreOptions<Root, Context extends StoreContext> = {
    state: Root
    context: Context
    enhancers?: StoreEnhancer<Root, Context>[]
}

export type AnyStore = Store<any, any>

export type InferStoreState<S> = S extends Store<infer State, any> ? State : never

export type InferStoreContext<S> = S extends Store<any, infer Context> ? Context : never

export type StoreContext = Record<string, unknown>

export class Store<Root, Context extends StoreContext> {
    state: Root

    context: Context

    enhancers: StoreEnhancer<Root, Context>[] = []

    constructor(options: StoreOptions<Root, Context>) {
        this.state = options.state
        this.context = options.context
        this.enhancers = [...this.enhancers, ...(options.enhancers ?? [])]

        for (const enhancer of this.enhancers) {
            const cleanup = enhancer(this)
            if (cleanup) {
                this.enhancerCleanup.push(cleanup)
            }
        }
    }

    private enhancerCleanup: (() => void)[] = []

    getState = (): Root => {
        return this.state
    }

    private dirty = false

    setState = (state: Root): void => {
        if (state === this.state) {
            return
        }

        this.state = state
        this.dirty = true

        // Schedule a microtask to publish the state change
        const currentPid = this.pid++
        Promise.resolve().then(() => {
            if (currentPid === this.pid) {
                this.publish()
            }
        })
    }

    pid = 0

    private listeners: ((state: Root) => unknown)[] = []

    subscribe(listener: (state: Root) => unknown): () => void {
        this.listeners.push(listener)

        return () => {
            const index = this.listeners.indexOf(listener)
            if (index !== -1) {
                this.listeners.splice(index, 1)
            }
        }
    }

    publish(): void {
        if (!this.dirty) {
            return
        }
        // Reset dirty flag
        this.dirty = false

        for (const listener of this.listeners) {
            listener(this.state)
        }
    }

    private executionListeners: ((tree: ExecutionTree) => unknown)[] = []

    subscribeExecution(listener: (tree: ExecutionTree) => unknown): () => void {
        this.executionListeners.push(listener)

        return () => {
            const index = this.executionListeners.indexOf(listener)
            if (index !== -1) {
                this.executionListeners.splice(index, 1)
            }
        }
    }

    private publishExecution(tree: ExecutionTree): void {
        for (const listener of this.executionListeners) {
            listener(tree)
        }
    }

    destroy(): void {
        this.listeners = []
        this.executionListeners = []

        for (const cleanup of this.enhancerCleanup) {
            cleanup()
        }

        this.enhancerCleanup = []
    }

    get<T>(domainOrOptic: Optic.Optic<T, Root> | Domain<T, Root>): Result.Result<T, Optic.OpticErr> {
        const result = this.runQuery(get(domainOrOptic))
        return result
    }

    set<T>(
        domainOrOptic: Optic.Optic<T, Root> | Domain<T, Root>,
        input: SetStateInput<T>,
    ): Result.Result<void, Optic.OpticErr> {
        const result = this.runCommand(set(domainOrOptic, input))
        return result
    }

    subscribeQuery<T, E extends QueryEff<Root> | Err.AnyErr | Async.Async | ToCtxEff<this['context']>>(options: {
        query: () => Generator<Exclude<E, SetRoot<any>>, T>
        onResult?: (result: Result.Result<T, E>) => unknown
        onErr?: (error: Koka.ExtractErr<E>) => unknown
        onOk?: (result: T) => unknown
    }): () => void {
        const handleResult = (result: Result.Result<T, E>) => {
            options.onResult?.(result)
            if (result.type === 'ok') {
                options.onOk?.(result.value)
            } else {
                options.onErr?.(result.error)
            }
        }
        const unsubscribe = this.subscribe(() => {
            const result = this.runQuery(options.query)

            if (result instanceof Promise) {
                result.then(handleResult as any)
            } else {
                handleResult(result as any)
            }
        })

        return unsubscribe
    }

    runQuery<T, E extends QueryEff<Root> | Err.AnyErr | Async.Async | ToCtxEff<this['context']>>(
        input: MaybeFunction<Generator<Exclude<E, SetRoot<any>>, T>>,
    ): Async.Async extends E ? Async.MaybePromise<Result.Result<T, E>> : Result.Result<T, E> {
        const query = typeof input === 'function' ? input() : input

        const executionTree: QueryExecutionTree | undefined =
            this.enhancers.length > 0
                ? {
                      type: 'query',
                      async: true,
                      name: '',
                      args: [],
                      return: undefined,
                      states: [],
                      queries: [],
                  }
                : undefined

        const withRoot = Koka.try(query as Generator<QueryEff<Root>, T>).handle({
            ...this.context,
            [GetRoot.field]: this.getState,
            [ExecutionTreeOpt.field]: executionTree,
        })

        const result = Result.run(withRoot) as any

        const handleResult = (result: any) => {
            if (executionTree) {
                executionTree.return = result
                this.publishExecution(executionTree)
            }
            return result
        }

        if (result instanceof Promise) {
            return result.then(handleResult) as any
        }

        return handleResult(result) as any
    }

    runCommand<T, E extends CommandEff<Root> | Err.AnyErr | Async.Async | ToCtxEff<this['context']>>(
        input: MaybeFunction<Generator<E, T>>,
    ): Async.Async extends E ? Async.MaybePromise<Result.Result<T, E>> : Result.Result<T, E> {
        const command = typeof input === 'function' ? input() : input

        const executionTree: CommandExecutionTree | undefined =
            this.enhancers.length > 0
                ? {
                      type: 'command',
                      async: true,
                      name: '#root#',
                      args: [],
                      return: undefined,
                      states: [],
                      changes: [],
                      commands: [],
                      queries: [],
                  }
                : undefined

        const withRoot = Koka.try(command as Generator<RootAccessor<Root> | CommandEff<Root>, any>).handle({
            ...this.context,
            [SetRoot.field]: this.setState,
            [GetRoot.field]: this.getState,
            [ExecutionTreeOpt.field]: executionTree,
        })

        try {
            const result = Result.run(withRoot) as any

            const handleResult = (result: any) => {
                if (executionTree) {
                    executionTree.return = result
                    this.publishExecution(executionTree)
                }
                return result
            }

            if (result instanceof Promise) {
                return result.then(handleResult) as any
            }

            return handleResult(result) as any
        } finally {
            this.publish()
        }
    }
}
