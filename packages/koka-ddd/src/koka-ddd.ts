import { Ctx, Eff, AnyErr, Async, MaybePromise, Result, AnyEff } from 'koka'
import { Updater, Optic, OpticOptions, OpticErr, getOpticValue, GetKey } from 'koka-optic'

export * from 'koka-optic'

export class Domain<State, Root> {
    $: Optic<State, Root>

    constructor(options: OpticOptions<State, Root>) {
        this.$ = new Optic<State, Root>(options)

        Object.defineProperty(this.$, 'getKey', {
            get: () => this.getKey,
        })
    }

    getKey?: GetKey<State>
}

export type SetStateInput<S> = S | Updater<S> | ((state: S) => S)

export class GetRoot<Root> extends Eff.Ctx('koka-ddd/get-root')<() => Root> {}

export class SetRoot<Root> extends Eff.Ctx('koka-ddd/set-root')<(Root: Root) => void> {}

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

export class ExecutionTreeOpt extends Eff.Opt('koka-ddd/execution-tree')<ExecutionTree> {}

export type CommandEff<Root> = OpticErr | RootAccessor<Root> | ExecutionTreeOpt

export type MaybeFunction<T> = T | (() => T)

export type DomainQuery<Return, Root, E extends AnyEff = never> = Generator<QueryEff<Root> | E, Return>

export type DomainCommand<Return, Root, E extends AnyEff = never> = Generator<CommandEff<Root> | E, Return>

export function* get<State, Root>(domainOrOptic: Domain<State, Root> | Optic<State, Root>): DomainQuery<State, Root> {
    const optic = domainOrOptic instanceof Domain ? domainOrOptic.$ : domainOrOptic

    const executionTree = yield* Eff.get(ExecutionTreeOpt)

    const getRoot = yield* Eff.get(GetRoot<Root>)

    const root = getRoot()

    const state = yield* optic.get(root)

    executionTree?.states.push(state)

    return state
}

export function* set<State, Root>(
    domainOrOptic: Domain<State, Root> | Optic<State, Root>,
    setStateInput: SetStateInput<State>,
): DomainCommand<void, Root> {
    const optic = domainOrOptic instanceof Domain ? domainOrOptic.$ : domainOrOptic

    const executionTree = yield* Eff.get(ExecutionTreeOpt)

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

        const result = (setStateInput as Updater<State> | ((state: State) => State))(state)

        const nextState = yield* getOpticValue(result)

        if (executionTree?.type === 'command') {
            executionTree.changes.push({
                previous: state,
                next: nextState,
            })
        }

        return nextState
    })

    const getRoot = yield* Eff.get(GetRoot<Root>)

    const root = getRoot()

    const newRoot = yield* updateRoot(root)

    const setRoot = yield* Eff.get(SetRoot<Root>)

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
    return function <This, Args extends any[], Root, Return, E extends AnyEff>(
        target: (this: This, ...args: Args) => Generator<Exclude<E, SetRoot<any>>, Return>,
        context: KokaClassMethodDecoratorContext<This, typeof target>,
    ): (this: This, ...args: Args) => Generator<Exclude<E, SetRoot<any>> | ExecutionTreeOpt | QueryEff<Root>, Return> {
        const methodName = context.name

        function* replacementMethod(
            this: This,
            ...args: Args
        ): Generator<Exclude<E, SetRoot<any>> | ExecutionTreeOpt | QueryEff<Root>, Return> {
            const parent: ExecutionTree | undefined = yield* Eff.get(ExecutionTreeOpt)

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

            const gen = Eff.try(target.call(this, ...args)).catch({
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
    return function <This, Args extends any[], Root, Return, E extends AnyEff>(
        target: (this: This, ...args: Args) => Generator<E | CommandEff<Root>, Return>,
        context: KokaClassMethodDecoratorContext<This, typeof target>,
    ): typeof target {
        const methodName = context.name

        function* replacementMethod(this: This, ...args: Args): Generator<any, Return, unknown> {
            const parent: ExecutionTree | undefined = yield* Eff.get(ExecutionTreeOpt)

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

            const gen = Eff.try(target.call(this, ...args)).catch({
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

export type StoreContext = Record<string, unknown>

type ToCtxEff<T extends StoreContext> = {
    [K in keyof T]: K extends string ? Ctx<K, T[K]> : never
}[keyof T]

export type StoreEnhancer<State> = (store: Store<State>) => void

export type StoreOptions<State> = {
    state: State
    enhancers?: StoreEnhancer<State>[]
}

export class Store<State> {
    state: State

    context: StoreContext = {}

    enhancers: StoreEnhancer<State>[] = []

    constructor(options: StoreOptions<State>) {
        this.state = options.state
        this.enhancers = [...this.enhancers, ...(options.enhancers ?? [])]

        for (const enhancer of this.enhancers) {
            enhancer(this)
        }
    }

    getState = (): State => {
        return this.state
    }

    private dirty = false

    setState = (state: State): void => {
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

    private listeners: ((state: State) => unknown)[] = []

    subscribe(listener: (state: State) => unknown): () => void {
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

    get<T>(domainOrOptic: Optic<T, State> | Domain<T, State>): Result<T, OpticErr> {
        const result = this.runQuery(get(domainOrOptic))
        return result
    }

    set<T>(domainOrOptic: Optic<T, State> | Domain<T, State>, input: SetStateInput<T>): Result<void, OpticErr> {
        const result = this.runCommand(set(domainOrOptic, input))
        return result
    }

    runQuery<T, E extends QueryEff<State> | AnyErr | Async | ToCtxEff<this['context']>>(
        input: MaybeFunction<Generator<Exclude<E, SetRoot<any>>, T>>,
    ): Async extends E ? MaybePromise<Result<T, E>> : Result<T, E> {
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

        const withRoot = Eff.try(query as Generator<QueryEff<State>, T>).catch({
            ...this.context,
            [GetRoot.field]: this.getState,
            [ExecutionTreeOpt.field]: executionTree,
        })

        const result = Eff.runResult(withRoot) as any

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

    runCommand<T, E extends CommandEff<State> | AnyErr | Async | ToCtxEff<this['context']>>(
        input: MaybeFunction<Generator<E, T>>,
    ): Async extends E ? MaybePromise<Result<T, E>> : Result<T, E> {
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

        const withRoot = Eff.try(command as Generator<RootAccessor<State> | CommandEff<State>, any>).catch({
            ...this.context,
            [SetRoot.field]: this.setState,
            [GetRoot.field]: this.getState,
            [ExecutionTreeOpt.field]: executionTree,
        })

        try {
            const result = Eff.runResult(withRoot) as any

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
