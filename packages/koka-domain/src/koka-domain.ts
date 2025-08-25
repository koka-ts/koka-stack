import * as Koka from 'koka'
import * as Optic from 'koka-optic'
import * as Opt from 'koka/opt'
import * as Result from 'koka/result'
import * as Err from 'koka/err'
import * as Async from 'koka/async'
import { shallowEqual } from './shallowEqual'

export { shallowEqual }

export function shallowEqualResult<T>(a: Result.Result<T, any>, b: Result.Result<T, any>): boolean {
    if (a === b) {
        return true
    }

    if (a.type === 'ok' && b.type === 'ok') {
        return shallowEqual(a.value, b.value)
    }
    if (a.type === 'err' && b.type === 'err') {
        return shallowEqual(a.error, b.error)
    }
    return false
}

export type StoreEnhancer<State> = (store: Store<State>) => (() => void) | void

export type StoreOptions<State> = {
    state: State
    enhancers?: StoreEnhancer<State>[]
}

export type AnyStore = Store<any>

export type InferStoreState<S> = S extends Store<infer State> ? State : never

export class Store<State> {
    state: State
    domain: Domain<State, State>

    enhancers: StoreEnhancer<State>[] = []
    private enhancerCleanup: (() => void)[] = []

    constructor(options: StoreOptions<State>) {
        this.state = options.state
        this.domain = new Domain({
            store: this,
            optic: Optic.root<State>(),
        })

        this.enhancers = [...this.enhancers, ...(options.enhancers ?? [])]

        for (const enhancer of this.enhancers) {
            const cleanup = enhancer(this)
            if (cleanup) {
                this.enhancerCleanup.push(cleanup)
            }
        }
    }

    getState = (): State => {
        return this.state
    }

    private dirty = false
    version = 0
    setState = (state: State): void => {
        if (shallowEqual(state, this.state)) {
            return
        }

        this.state = state
        this.dirty = true

        this.version += 1

        // Schedule a microtask to publish the state change
        const currentVersion = this.version
        this.promise = Promise.resolve().then(() => {
            if (currentVersion === this.version) {
                this.publish()
            }
        })
    }

    promise = Promise.resolve()

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

    destroy(): void {
        this.listeners = []

        for (const enhancer of this.enhancerCleanup) {
            enhancer()
        }

        this.enhancerCleanup = []
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

    publishExecution(tree: ExecutionTree): void {
        for (const listener of this.executionListeners) {
            listener(tree)
        }
    }
}

export type SetStateInput<S> = S | Optic.Updater<S> | ((state: S) => S)

export type DomainOptions<State, Root = unknown> = {
    store: Store<Root>
    optic: Optic.Optic<State, Root>
}

export type AnyDomain = Domain<any, any>

export class Domain<State, Root = unknown> {
    store: Store<Root>
    optic: Optic.Optic<State, Root>
    constructor(options: DomainOptions<State, Root>) {
        const optic = new Optic.Optic(options.optic)

        Object.defineProperty(optic, 'getKey', {
            get: () => {
                return this.getKey
            },
        })

        this.store = options.store
        this.optic = optic
    }

    getKey?: Optic.GetKey<State>

    transform<Target>(selector: Optic.Transformer<Target, State>): Domain<Target, Root> {
        return new Domain({
            store: this.store,
            optic: this.optic.transform(selector),
        })
    }

    prop<Key extends keyof State & string>(key: Key): Domain<State[Key], Root> {
        return new Domain({
            store: this.store,
            optic: this.optic.prop(key),
        })
    }

    index<Index extends keyof State & number>(index: Index): Domain<State[Index], Root> {
        return new Domain({
            store: this.store,
            optic: this.optic.index(index),
        })
    }

    find<Target extends Optic.ArrayItem<State>>(
        predicate:
            | ((item: Optic.ArrayItem<State>, index: number) => boolean)
            | ((item: Optic.ArrayItem<State>, index: number) => item is Target),
    ): Domain<Target, Root> {
        return new Domain({
            store: this.store,
            optic: this.optic.find(predicate),
        })
    }

    match<Matched extends State>(predicate: (state: State) => state is Matched): Domain<Matched, Root> {
        return new Domain({
            store: this.store,
            optic: this.optic.match(predicate),
        })
    }

    refine(predicate: (state: State) => boolean): Domain<State, Root> {
        return new Domain({
            store: this.store,
            optic: this.optic.refine(predicate),
        })
    }

    as<Refined>(): Domain<Refined, Root> {
        return new Domain({
            store: this.store,
            optic: this.optic.as<Refined>(),
        })
    }

    map<Target>(
        mapper:
            | Optic.Transformer<Target, Optic.ArrayItem<State>>
            | Optic.Optic<Target, Optic.ArrayItem<State>>
            | ((
                  state: Optic.Optic<Optic.ArrayItem<State>, Optic.ArrayItem<State>>,
              ) => Optic.Optic<Target, Optic.ArrayItem<State>>),
    ): Domain<Target[], Root> {
        return new Domain({
            store: this.store,
            optic: this.optic.map(mapper),
        })
    }

    filter<Target extends Optic.ArrayItem<State>>(
        predicate:
            | ((item: Optic.ArrayItem<State>, index: number) => boolean)
            | ((item: Optic.ArrayItem<State>, index: number) => item is Target),
    ): Domain<Target[], Root> {
        return new Domain({
            store: this.store,
            optic: this.optic.filter(predicate),
        })
    }

    select<Selected>(selector: (proxy: Optic.OpticProxy<State>) => Optic.OpticProxy<Selected>): Domain<Selected, Root> {
        return new Domain({
            store: this.store,
            optic: this.optic.select(selector),
        })
    }
}

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

export class CommandTracerOpt extends Opt.Opt('koka-domain/command-tracer-opt')<CommandExecutionTree> {}
export class QueryTracerOpt extends Opt.Opt('koka-domain/query-tracer-opt')<QueryExecutionTree> {}

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

export type Query<Return, Yield extends Err.AnyErr = Err.AnyErr> = {
    (): Generator<Yield | QueryOpt, Return, unknown>
    store?: AnyStore
}

export type AnyQuery = Query<any>

type QueryStorage = {
    domainDeps: Map<AnyDomain, Result.Result<any, Optic.OpticErr>>
    queryDeps: Map<AnyQuery, Result.Result<any, Err.AnyErr>>
    current?: {
        version: number
        result: Result.Result<any, Err.AnyErr>
    }
}

const checkQueryStorageDeps = (queryStorage: QueryStorage) => {
    for (const [domain, result] of queryStorage.domainDeps) {
        const currentResult = getState(domain)

        if (!shallowEqualResult(currentResult, result)) {
            return false
        }
    }

    for (const [query, result] of queryStorage.queryDeps) {
        const currentResult = getQueryResult(query)

        if (!shallowEqualResult(currentResult, result)) {
            return false
        }
    }

    return true
}

class QueryStorageOpt extends Opt.Opt('koka-domain/query-storage-opt')<QueryStorage> {}

const queryStorages = new WeakMap<Query<any, any>, QueryStorage>()

export function query() {
    return function <This, Args extends any[], Return, Yield extends Err.AnyErr = Err.AnyErr>(
        target: (this: This, ...args: Args) => Generator<Yield | QueryOpt, Return>,
        context: KokaClassMethodDecoratorContext<This, typeof target>,
    ): Query<Return, Yield> {
        const methodName = context.name

        context.addInitializer(function () {
            // @ts-ignore
            this[methodName] = this[methodName].bind(this)

            // @ts-ignore
            this[methodName].store = this.store
        })

        function* replacementMethod(this: AnyDomain, ...args: Args): Generator<Yield | QueryOpt, Return> {
            const parentQueryTree: QueryExecutionTree | undefined = yield* Opt.get(QueryTracerOpt)

            const name = `${(this as any).constructor?.name ?? 'UnknownDomain'}.${methodName}`
            const queryExecutionTree: QueryExecutionTree | undefined = parentQueryTree
                ? {
                      type: 'query',
                      async: false,
                      name,
                      args: args,
                      return: undefined,
                      states: [],
                      queries: [],
                  }
                : undefined

            if (parentQueryTree && queryExecutionTree) {
                parentQueryTree.queries.push(queryExecutionTree)
            }

            const handledQueryEff = Koka.try(target.call(this as This, ...args)).handle({
                [QueryTracerOpt.field]: queryExecutionTree,
            } as any)

            const result: Result.Result<any, Err.AnyErr> = yield* Result.wrap(handledQueryEff)

            if (result.type === 'err') {
                throw yield* Err.throw(result) as any
            }

            if (queryExecutionTree) {
                queryExecutionTree.return = result.value
            }

            if (!parentQueryTree && queryExecutionTree) {
                this.store.publishExecution(queryExecutionTree)
            }

            return result.value as Return
        }

        return function* query(this: This, ...args: Args) {
            if (!(this instanceof Domain)) {
                throw new Error('Query must be used on a Domain class')
            }

            const parentQueryStorage = yield* Opt.get(QueryStorageOpt)

            const queryMethod = this[methodName as keyof This] as AnyQuery

            let queryStorage = queryStorages.get(queryMethod)

            if (queryStorage) {
                if (queryStorage.current) {
                    const canUseCurrent =
                        queryStorage.current.version === this.store.version || checkQueryStorageDeps(queryStorage)

                    if (canUseCurrent) {
                        const result = queryStorage.current.result

                        parentQueryStorage?.queryDeps.set(queryMethod, result)

                        if (result.type === 'ok') {
                            return result.value as Return
                        }

                        throw yield* Err.throw(result) as any
                    }
                }
            } else {
                queryStorage = {
                    domainDeps: new Map(),
                    queryDeps: new Map(),
                }

                queryStorages.set(queryMethod, queryStorage)
            }

            const withQueryStorage = Koka.try(replacementMethod.call(this, ...args)).handle({
                [QueryStorageOpt.field]: queryStorage,
            } as any)

            const result = (yield* Result.wrap(withQueryStorage)) as Result.Result<any, Err.AnyErr>

            parentQueryStorage?.queryDeps.set(queryMethod, result)

            queryStorage.current = {
                version: this.store.version,
                result,
            }

            if (result.type === 'ok') {
                return result.value as Return
            }

            throw yield* Err.throw(result) as any
        } as any
    }
}

const queryResultWeakMap = new WeakMap<Query<any, any>, Result.Result<any, any>>()

export function getQueryResult<Return, Yield extends Err.AnyErr = Err.AnyErr>(
    query: Query<Return, Yield>,
): Result.Result<Return, Err.ExtractErr<Yield>> {
    const result = Result.run(query())

    const previousResult = queryResultWeakMap.get(query)

    if (previousResult && shallowEqualResult(result, previousResult)) {
        return previousResult
    }

    queryResultWeakMap.set(query, result)

    return result
}

export function getQueryState<Return, Yield extends Err.AnyErr = Err.AnyErr>(query: Query<Return, Yield>): Return {
    const result = getQueryResult(query)

    if (result.type === 'err') {
        throw new Error(`Query ${query.name} returned an error: ${JSON.stringify(result.error)}`)
    }

    return result.value
}

export function subscribeQueryResult<Return, Yield extends Err.AnyErr = Err.AnyErr>(
    query: Query<Return, Yield>,
    listener: (result: Result.Result<Return, Err.ExtractErr<Yield>>) => unknown,
): () => void {
    let previousResult: Result.Result<Return, Err.ExtractErr<Yield>> = getQueryResult(query)

    const store = query.store

    if (!store) {
        throw new Error('Query has no store')
    }

    return store.subscribe(() => {
        const result = getQueryResult(query)

        if (previousResult && shallowEqualResult(result, previousResult)) {
            return
        }

        previousResult = result
        listener(result)
    })
}

export function subscribeQueryState<Return, Yield extends Err.AnyErr = Err.AnyErr>(
    query: Query<Return, Yield>,
    listener: (state: Return) => unknown,
): () => void {
    return subscribeQueryResult(query, (result) => {
        if (result.type === 'err') {
            return
        }

        listener(result.value)
    })
}
export function command() {
    return function <This, Args extends any[], Return, E extends Koka.AnyEff>(
        target: (this: This, ...args: Args) => Generator<E, Return>,
        context: KokaClassMethodDecoratorContext<This, typeof target>,
    ): typeof target {
        const methodName = context.name

        context.addInitializer(function () {
            // @ts-ignore
            this[methodName] = this[methodName].bind(this)
        })

        function* replacementMethod(
            this: This,
            ...args: Args
        ): Generator<E | CommandTracerOpt | QueryTracerOpt, Return, unknown> {
            if (!(this instanceof Domain)) {
                throw new Error('Command must be used on a Domain class')
            }

            const parent: CommandExecutionTree | undefined = yield* Opt.get(CommandTracerOpt)

            const name = `${(this as any).constructor?.name ?? 'UnknownDomain'}.${methodName}`
            const commandTree: CommandExecutionTree = {
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

            const queryTree: QueryExecutionTree = {
                type: 'query',
                async: false,
                name,
                args: args,
                return: undefined,
                states: [],
                queries: [],
            }

            parent?.commands.push(commandTree)

            const gen = Koka.try(target.call(this, ...args)).handle({
                [CommandTracerOpt.field]: commandTree,
                [QueryTracerOpt.field]: queryTree,
            } as any)

            let result = gen.next()

            while (!result.done) {
                const effect = result.value

                if (effect.type === 'async') {
                    commandTree.async = true
                    result = gen.next(yield effect as any)
                } else {
                    result = gen.next(yield effect as any)
                }
            }

            commandTree.queries = queryTree.queries
            commandTree.return = result.value

            if (!parent) {
                this.store.publishExecution(commandTree)
            }

            return result.value as Return
        }

        return replacementMethod as any
    }
}

export type QueryOpt = QueryStorageOpt | QueryTracerOpt

function* getDomainState<State, Root>(domain: Domain<State, Root>): Generator<Optic.OpticErr | QueryOpt, State> {
    const queryTree = yield* Opt.get(QueryTracerOpt)

    const rootState = domain.store.getState()
    const state = yield* Optic.get(rootState, domain.optic)

    if (queryTree) {
        queryTree.states.push(state)
    }

    return state
}

type DomainStorage = {
    version: number
    result: Result.Result<any, Optic.OpticErr>
}

const domainStorages = new WeakMap<Domain<any, any>, DomainStorage>()

export function* get<State, Root>(domain: Domain<State, Root>): Generator<Optic.OpticErr | QueryOpt, State> {
    const domainStorage = domainStorages.get(domain)
    const parentQueryStorage = yield* Opt.get(QueryStorageOpt)

    if (domainStorage) {
        if (domainStorage.version === domain.store.version) {
            const result = domainStorage.result

            parentQueryStorage?.domainDeps.set(domain, result)

            if (result.type === 'ok') {
                return result.value as State
            }

            throw yield* Err.throw(result) as any
        }
    }

    const result = yield* Result.wrap(getDomainState(domain))

    parentQueryStorage?.domainDeps.set(domain, result)

    domainStorages.set(domain, {
        version: domain.store.version,
        result,
    })

    if (result.type === 'ok') {
        return result.value as State
    }

    throw yield* Err.throw(result) as any
}

export function* set<State, Root>(
    domain: Domain<State, Root>,
    setStateInput: SetStateInput<State>,
): Generator<Optic.OpticErr | CommandTracerOpt, Root> {
    const commandTree = yield* Opt.get(CommandTracerOpt)

    const rootState = domain.store.getState()

    const newRootState = yield* Optic.set(rootState, domain.optic, function* (state) {
        if (typeof setStateInput !== 'function') {
            if (shallowEqual(state, setStateInput)) {
                return state
            }

            if (commandTree) {
                commandTree.changes.push({
                    previous: state,
                    next: setStateInput,
                })
            }
            return setStateInput
        }

        const result = (setStateInput as Optic.Updater<State> | ((state: State) => State))(state)

        const nextState = yield* Optic.getOpticValue(result)

        if (shallowEqual(nextState, state)) {
            return state
        }

        if (commandTree) {
            commandTree.changes.push({
                previous: state,
                next: nextState,
            })
        }

        return nextState
    })

    domain.store.setState(newRootState)

    return newRootState
}

const previousResultWeakMap = new WeakMap<Domain<any, any>, Result.Result<any, any>>()

export function getState<State, Root>(domain: Domain<State, Root>): Result.Result<State, Optic.OpticErr> {
    const result = Result.run(get(domain))

    const previousResult = previousResultWeakMap.get(domain)

    if (previousResult) {
        if (shallowEqualResult(result, previousResult)) {
            return previousResult
        }
    }

    previousResultWeakMap.set(domain, result)

    return result
}

export function setState<State, Root>(
    domain: Domain<State, Root>,
    setStateInput: SetStateInput<State>,
): Result.Result<Root, Optic.OpticErr> {
    return Result.run(set(domain, setStateInput))
}

export function subscribeDomainResult<State, Root>(
    domain: Domain<State, Root>,
    listener: (result: Result.Result<State, Optic.OpticErr>) => unknown,
): () => void {
    let previousResult: Result.Result<State, Optic.OpticErr> | undefined

    return domain.store.subscribe(() => {
        const result = getState(domain)

        if (previousResult && shallowEqualResult(result, previousResult)) {
            return
        }

        previousResult = result

        listener(result)
    })
}

export function subscribeDomainState<State, Root>(
    domain: Domain<State, Root>,
    listener: (state: State) => unknown,
): () => void {
    return subscribeDomainResult(domain, (result) => {
        if (result.type === 'err') {
            return
        }

        listener(result.value)
    })
}
