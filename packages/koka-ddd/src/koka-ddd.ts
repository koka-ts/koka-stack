import * as DDD from 'koka'
import * as Accessor from 'koka-accessor'
import * as Opt from 'koka/opt'
import * as Result from 'koka/result'
import * as Err from 'koka/err'
import * as Async from 'koka/async'
import * as Task from 'koka/task'
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

export type StorePlugin<Root> = (store: Store<Root>) => (() => void) | void

export type StoreOptions<Root> = {
    state: Root
    plugins?: StorePlugin<Root>[]
}

export type AnyStore = Store<any>

export type InferStoreState<S> = S extends Store<infer State> ? State : never

export class Store<Root> {
    state: Root
    domain: Domain<Root, Root, this>

    plugins: StorePlugin<Root>[] = []
    private pluginCleanup: (() => void)[] = []

    constructor(options: StoreOptions<Root>) {
        this.state = options.state
        this.domain = new Domain<Root, Root, this>({
            store: this,
            accessor: Accessor.root<Root>(),
        })

        this.plugins = [...this.plugins, ...(options.plugins ?? [])]

        for (const plugin of this.plugins) {
            const cleanup = plugin(this)
            if (cleanup) {
                this.pluginCleanup.push(cleanup)
            }
        }
    }

    getState = (): Root => {
        return this.state
    }

    private dirty = false
    version = 0
    setState = (state: Root): void => {
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

    destroy(): void {
        this.listeners = []

        for (const cleanup of this.pluginCleanup) {
            cleanup()
        }

        this.pluginCleanup = []
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

export type CommandEff = Accessor.AccessorErr | Async.Async | QueryOpt | CommandTracerOpt | EventTracerOpt

export type EventInput<E extends AnyEvent, D extends AnyDomain> = {
    domain: D
    event: E
}

export interface Event<Name extends string, T> {
    type: 'event'
    name: Name
    payload: T
}

export type AnyEvent = Event<string, any>

export function Event<const Name extends string>(name: Name) {
    return class Eff<T = void> implements Event<Name, T> {
        static field: Name = name
        type = 'event' as const
        name = name
        payload: T
        constructor(payload: T) {
            this.payload = payload
        }
    }
}

type EventCtor<Name extends string, T> = new (...args: any[]) => Event<Name, T>

type AnyEventCtor = EventCtor<string, any>

export type EventValue<E extends AnyEvent> = E['payload']

export type EventHandler<E extends AnyEvent> = (event: E) => Generator<CommandEff, unknown>

const eventHandlersStorages = new WeakMap<
    AnyDomain,
    Map<new (...args: any[]) => AnyEvent, Array<EventHandler<AnyEvent>>>
>()

export function event<ES extends AnyEventCtor[]>(...Events: ES) {
    return function <This extends AnyDomain, Return, E extends DDD.AnyEff>(
        target: (this: This, event: InstanceType<ES[number]>) => Generator<E, Return>,
        context: KokaClassMethodDecoratorContext<This, typeof target>,
    ): typeof target {
        context.addInitializer(function () {
            if (!(this instanceof Domain)) {
                throw new Error('Event must be used on a Domain class')
            }

            let eventHandlersStorage = eventHandlersStorages.get(this)

            if (!eventHandlersStorage) {
                eventHandlersStorage = new Map()
                eventHandlersStorages.set(this, eventHandlersStorage)
            }

            for (const Event of Events) {
                let eventHandlers = eventHandlersStorage.get(Event)

                if (!eventHandlers) {
                    eventHandlers = []
                    eventHandlersStorage.set(Event, eventHandlers)
                }

                const eventHandler = target.bind(this) as unknown as EventHandler<AnyEvent>
                eventHandlers.push(eventHandler)
            }
        })

        return target
    }
}

export function* emit<D extends AnyDomain, E extends AnyEvent>(domain: D, event: E): Generator<CommandEff, void> {
    const eventHandlers = eventHandlersStorages.get(domain)

    if (eventHandlers) {
        const eventHandlerList = eventHandlers.get(event.constructor as AnyEventCtor)
        if (eventHandlerList) {
            const parent = yield* Opt.get(CommandTracerOpt)

            const eventTree: EventExecutionTree = {
                type: 'event',
                async: true,
                domainName: domain.constructor.name,
                name: event.constructor.name,
                payload: event.payload,
                commands: [],
            }

            parent?.events.push(eventTree)

            const effector = Task.all(eventHandlerList.map((eventHandler) => eventHandler(event)))

            const result = Result.run(
                DDD.try(effector).handle({
                    [EventTracerOpt.field]: eventTree,
                }),
            ) as Result.Result<unknown, Err.AnyErr>

            if (result.type === 'err') {
                throw yield* Err.throw(result) as any
            }

            return
        }
    }

    if (domain.parent) {
        yield* emit(domain.parent, event)
    }
}

export type SetStateInput<S> = S | Accessor.Updater<S> | ((state: S) => S)

export type PureDomain<State, Root = any, Enhancer extends {} = {}> = {
    store: Store<Root> & Enhancer
    accessor: Accessor.Accessor<State, Root>
    parent?: Domain<any, Root, Enhancer>
}

export type AnyDomain = PureDomain<any, any>

export type InferDomainEnhancer<D extends AnyDomain> = D extends PureDomain<any, any, infer Enhancer> ? Enhancer : never

export type InferDomainState<D extends AnyDomain> = D extends PureDomain<infer State, any, any> ? State : never

export type InferDomainRoot<D extends AnyDomain> = D extends PureDomain<any, infer Root, any> ? Root : never

export class Domain<State, Root = any, Enhancer extends {} = {}> implements PureDomain<State, Root, Enhancer> {
    store: Store<Root> & Enhancer
    accessor: Accessor.Accessor<State, Root>
    parent?: Domain<any, Root, Enhancer>
    constructor(options: PureDomain<State, Root, Enhancer>) {
        const accessor = new Accessor.Accessor(options.accessor)

        Object.defineProperty(accessor, 'getKey', {
            get: () => {
                return this.getKey
            },
        })

        this.store = options.store
        this.accessor = accessor
        this.parent = options.parent
    }

    getKey?: Accessor.GetKey<State>

    transform<Target>(selector: Accessor.Transformer<Target, State>): Domain<Target, Root, Enhancer> {
        return new Domain({
            store: this.store,
            accessor: this.accessor.transform(selector),
            parent: this.parent,
        })
    }

    prop<Key extends keyof State & string>(key: Key): Domain<State[Key], Root, Enhancer> {
        return new Domain({
            store: this.store,
            accessor: this.accessor.prop(key),
            parent: this.parent,
        })
    }

    index<Index extends keyof State & number>(index: Index): Domain<State[Index], Root, Enhancer> {
        return new Domain({
            store: this.store,
            accessor: this.accessor.index(index),
            parent: this.parent,
        })
    }

    find<Target extends Accessor.ArrayItem<State>>(
        predicate:
            | ((item: Accessor.ArrayItem<State>, index: number) => boolean)
            | ((item: Accessor.ArrayItem<State>, index: number) => item is Target),
    ): Domain<Target, Root, Enhancer> {
        return new Domain({
            store: this.store,
            accessor: this.accessor.find(predicate),
            parent: this.parent,
        })
    }

    match<Matched extends State>(predicate: (state: State) => state is Matched): Domain<Matched, Root, Enhancer> {
        return new Domain({
            store: this.store,
            accessor: this.accessor.match(predicate),
            parent: this.parent,
        })
    }

    refine(predicate: (state: State) => boolean): Domain<State, Root, Enhancer> {
        return new Domain({
            store: this.store,
            accessor: this.accessor.refine(predicate),
            parent: this.parent,
        })
    }

    as<Refined>(): Domain<Refined, Root, Enhancer> {
        return new Domain({
            store: this.store,
            accessor: this.accessor.as<Refined>(),
            parent: this.parent,
        })
    }

    map<Target>(
        mapper:
            | Accessor.Transformer<Target, Accessor.ArrayItem<State>>
            | Accessor.Accessor<Target, Accessor.ArrayItem<State>>
            | ((
                  state: Accessor.Accessor<Accessor.ArrayItem<State>, Accessor.ArrayItem<State>>,
              ) => Accessor.Accessor<Target, Accessor.ArrayItem<State>>),
    ): Domain<Target[], Root, Enhancer> {
        return new Domain({
            store: this.store,
            accessor: this.accessor.map(mapper),
            parent: this.parent,
        })
    }

    filter<Target extends Accessor.ArrayItem<State>>(
        predicate:
            | ((item: Accessor.ArrayItem<State>, index: number) => boolean)
            | ((item: Accessor.ArrayItem<State>, index: number) => item is Target),
    ): Domain<Target[], Root, Enhancer> {
        return new Domain({
            store: this.store,
            accessor: this.accessor.filter(predicate),
            parent: this.parent,
        })
    }

    select<Selected>(
        selector: (proxy: Accessor.AccessorProxy<State>) => Accessor.AccessorProxy<Selected>,
    ): Domain<Selected, Root, Enhancer> {
        return new Domain({
            store: this.store,
            accessor: this.accessor.proxy(selector),
            parent: this.parent,
        })
    }
}

export type StoreCtor<S extends AnyStore = AnyStore> =
    | (abstract new <Root>(options: StoreOptions<Root>) => S)
    | (new <Root>(options: StoreOptions<Root>) => S)

export type ExecutionTree = CommandExecutionTree | QueryExecutionTree | EventExecutionTree

export type StateChange = {
    previous: unknown
    next: unknown
}

export type CommandExecutionTree = {
    type: 'command'
    domainName: string
    name: string
    async: boolean
    args: unknown[]
    result?: Result.Result<unknown, Err.AnyErr>
    states: unknown[]
    changes: StateChange[]
    commands: CommandExecutionTree[]
    queries: QueryExecutionTree[]
    events: EventExecutionTree[]
}

export type QueryExecutionTree = {
    type: 'query'
    domainName: string
    async: boolean
    name: string
    args: unknown[]
    result?: Result.Result<unknown, Err.AnyErr>
    states: unknown[]
    queries: QueryExecutionTree[]
}

export type EventExecutionTree = {
    type: 'event'
    async: true
    domainName: string
    name: string
    payload: unknown
    commands: CommandExecutionTree[]
}

export class CommandTracerOpt extends Opt.Opt('koka-ddd/command-tracer-opt')<CommandExecutionTree> {}
export class QueryTracerOpt extends Opt.Opt('koka-ddd/query-tracer-opt')<QueryExecutionTree> {}
export class EventTracerOpt extends Opt.Opt('koka-ddd/event-tracer-opt')<EventExecutionTree> {}

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
    (): Generator<Yield | QueryOpt, Return>
    store?: AnyStore
}

export type AnyQuery = Query<any>

type QueryStorage = {
    domainDeps: Map<AnyDomain, Result.Result<any, Accessor.AccessorErr>>
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

class QueryStorageOpt extends Opt.Opt('koka-ddd/query-storage-opt')<QueryStorage> {}

const queryStorages = new WeakMap<Query<any, any>, QueryStorage>()

export function query() {
    return function <This extends AnyDomain, Args extends any[], Return, Yield extends DDD.AnyEff>(
        target: (this: This, ...args: Args) => Generator<Yield | QueryOpt, Return>,
        context: KokaClassMethodDecoratorContext<This, typeof target>,
    ): typeof target {
        const methodName = context.name

        context.addInitializer(function () {
            // @ts-ignore
            this[methodName] = this[methodName].bind(this)

            // @ts-ignore
            this[methodName].store = this.store
        })

        function* replacementMethod(this: This, ...args: Args): Generator<Yield | QueryOpt, Return> {
            const domainName = (this as any).constructor?.name ?? 'UnknownDomain'
            const parentQueryTree: QueryExecutionTree | undefined = yield* Opt.get(QueryTracerOpt)

            const name = methodName
            const queryExecutionTree: QueryExecutionTree | undefined = parentQueryTree
                ? {
                      type: 'query',
                      domainName,
                      async: false,
                      name: name,
                      args: args,
                      states: [],
                      queries: [],
                  }
                : undefined

            if (parentQueryTree && queryExecutionTree) {
                parentQueryTree.queries.push(queryExecutionTree)
            }

            const handledQueryEff = DDD.try(target.call(this as This, ...args)).handle({
                [QueryTracerOpt.field]: queryExecutionTree,
            } as any)

            const result: Result.Result<any, Err.AnyErr> = yield* Result.wrap(handledQueryEff)

            if (queryExecutionTree) {
                queryExecutionTree.result = result
            }

            if (!parentQueryTree && queryExecutionTree) {
                this.store.publishExecution(queryExecutionTree)
            }

            if (result.type === 'err') {
                throw yield* Err.throw(result) as any
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

            const withQueryStorage = DDD.try(replacementMethod.call(this, ...args)).handle({
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
    return function <This extends AnyDomain, Args extends any[], Return, E extends DDD.AnyEff>(
        target: (this: This, ...args: Args) => Generator<E, Return>,
        context: KokaClassMethodDecoratorContext<This, typeof target>,
    ): typeof target {
        const methodName = context.name

        function* replacementMethod(this: This, ...args: Args): Generator<E | CommandEff, Return> {
            if (!(this instanceof Domain)) {
                throw new Error('Command must be used on a Domain class')
            }

            const domainName = (this as any).constructor?.name ?? 'UnknownDomain'
            const parent = yield* Opt.get(CommandTracerOpt)

            const eventTree = yield* Opt.get(EventTracerOpt)

            const name = methodName
            const commandTree: CommandExecutionTree = {
                type: 'command',
                domainName,
                async: false,
                name: name,
                args: args,
                states: [],
                changes: [],
                commands: [],
                queries: [],
                events: [],
            }

            const queryTree: QueryExecutionTree = {
                type: 'query',
                domainName,
                async: false,
                name: name,
                args: args,
                states: [],
                queries: [],
            }

            if (parent) {
                parent.commands.push(commandTree)
            } else if (eventTree) {
                eventTree.commands.push(commandTree)
            }

            const gen = DDD.try(Result.wrap(target.call(this, ...args))).handle({
                [CommandTracerOpt.field]: commandTree,
                [QueryTracerOpt.field]: queryTree,
            } as any)

            let iteratorResult = gen.next()

            while (!iteratorResult.done) {
                const effect = iteratorResult.value

                if (effect.type === 'async') {
                    commandTree.async = true
                    iteratorResult = gen.next(yield effect as any)
                } else {
                    iteratorResult = gen.next(yield effect as any)
                }
            }

            const result = iteratorResult.value as Result.Result<unknown, Err.AnyErr>

            commandTree.queries = queryTree.queries
            commandTree.states = queryTree.states
            commandTree.result = result

            if (!parent && !eventTree) {
                this.store.publishExecution(commandTree)
            }

            if (result.type === 'err') {
                throw yield* Err.throw(result) as any
            }

            return result.value as Return
        }

        return replacementMethod as any
    }
}

export type QueryOpt = QueryStorageOpt | QueryTracerOpt

function* getDomainState<State, Root>(
    domain: PureDomain<State, Root>,
): Generator<Accessor.AccessorErr | QueryOpt, State> {
    const queryTree = yield* Opt.get(QueryTracerOpt)

    const rootState = domain.store.getState()
    const state = yield* Accessor.get(rootState, domain.accessor)

    if (queryTree) {
        queryTree.states.push(state)
    }

    return state
}

type DomainStorage = {
    version: number
    result: Result.Result<any, Accessor.AccessorErr>
}

const domainStorages = new WeakMap<PureDomain<any, any>, DomainStorage>()

export function* get<State, Root>(domain: PureDomain<State, Root>): Generator<Accessor.AccessorErr | QueryOpt, State> {
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
    domain: PureDomain<State, Root>,
    setStateInput: SetStateInput<State>,
): Generator<Accessor.AccessorErr | CommandTracerOpt, Root> {
    const commandTree = yield* Opt.get(CommandTracerOpt)

    const rootState = domain.store.getState()

    const newRootState = yield* Accessor.set(rootState, domain.accessor, function* (state) {
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

        const result = (setStateInput as Accessor.Updater<State> | ((state: State) => State))(state)

        const nextState = yield* Accessor.getValue(result)

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

const previousResultWeakMap = new WeakMap<PureDomain<any, any>, Result.Result<any, any>>()

export function getState<State, Root>(domain: PureDomain<State, Root>): Result.Result<State, Accessor.AccessorErr> {
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
    domain: PureDomain<State, Root>,
    setStateInput: SetStateInput<State>,
): Result.Result<Root, Accessor.AccessorErr> {
    return Result.run(set(domain, setStateInput))
}

export function subscribeDomainResult<State, Root>(
    domain: PureDomain<State, Root>,
    listener: (result: Result.Result<State, Accessor.AccessorErr>) => unknown,
): () => void {
    let previousResult: Result.Result<State, Accessor.AccessorErr> | undefined

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
    domain: PureDomain<State, Root>,
    listener: (state: State) => unknown,
): () => void {
    return subscribeDomainResult(domain, (result) => {
        if (result.type === 'err') {
            return
        }

        listener(result.value)
    })
}
