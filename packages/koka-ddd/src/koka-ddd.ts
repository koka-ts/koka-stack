import * as Koka from 'koka'
import * as Optic from 'koka-optic'
import * as Opt from 'koka/opt'
import * as Result from 'koka/result'
import { shallowEqual } from './shallowEqual'

export { shallowEqual }

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

    setState = (state: State): void => {
        if (state === this.state) {
            return
        }

        this.state = state
        this.dirty = true

        this.pid += 1

        // Schedule a microtask to publish the state change
        const currentPid = this.pid
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

    destroy(): void {
        this.listeners = []
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

const DEFAULT_STATE = Symbol('DEFAULT_STATE')

type DEFAULT_STATE = typeof DEFAULT_STATE

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

export class CommandOpt extends Opt.Opt('koka-ddd/command-opt')<CommandExecutionTree> {}
export class QueryOpt extends Opt.Opt('koka-ddd/query-opt')<QueryExecutionTree> {}

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
    return function <This extends AnyDomain, Args extends any[], Return, E extends Koka.AnyEff>(
        target: (this: This, ...args: Args) => Generator<Exclude<E, CommandOpt>, Return>,
        context: KokaClassMethodDecoratorContext<This, typeof target>,
    ): (this: This, ...args: Args) => Generator<Exclude<E, CommandOpt> | QueryOpt, Return> {
        const methodName = context.name

        function* replacementMethod(this: This, ...args: Args): Generator<Exclude<E, CommandOpt> | QueryOpt, Return> {
            const parent: QueryExecutionTree | undefined = yield* Opt.get(QueryOpt)

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
                [QueryOpt.field]: executionTree,
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

            if (!parent) {
                this.store.publishExecution(executionTree)
            }

            return result.value as Return
        }

        return replacementMethod
    }
}

export function command() {
    return function <This, Args extends any[], Return, E extends Koka.AnyEff>(
        target: (this: This, ...args: Args) => Generator<E, Return>,
        context: KokaClassMethodDecoratorContext<This, typeof target>,
    ): typeof target {
        const methodName = context.name

        function* replacementMethod(this: This, ...args: Args): Generator<E | CommandOpt | QueryOpt, Return, unknown> {
            const parent: CommandExecutionTree | undefined = yield* Opt.get(CommandOpt)

            const name = `${(this as any).constructor?.name ?? 'UnknownDomain'}.${methodName}`
            const commandTree: CommandExecutionTree = {
                type: 'command',
                async: false,
                name,
                args: args,
                return: undefined,
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
                [CommandOpt.field]: commandTree,
                [QueryOpt.field]: queryTree,
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
                ;(this as AnyDomain).store.publishExecution(commandTree)
            }

            return result.value as Return
        }

        return replacementMethod as any
    }
}

export type AnyDomain = Domain<any, any>

export class Domain<State, Root> {
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

    private previousResult: Result.Result<State, any> | undefined

    getState = () => {
        const result = Result.run(this.get())

        if (result.type === 'ok' && this.previousResult?.type === 'ok') {
            if (shallowEqual(result.value, this.previousResult.value)) {
                return this.previousResult as typeof result
            }
        }

        if (result.type === 'err' && this.previousResult?.type === 'err') {
            if (shallowEqual(result.error, this.previousResult.error)) {
                return this.previousResult as typeof result
            }
        }

        this.previousResult = result

        return result
    }

    setState = (input: SetStateInput<State>) => {
        return Result.run(this.set(input))
    };

    *get(): Generator<Optic.OpticErr | QueryOpt, State> {
        const queryTree = yield* Opt.get(QueryOpt)
        const rootState = this.store.getState()
        const state = yield* Optic.get(rootState, this.optic)

        if (queryTree) {
            queryTree.states.push(state)
        }

        return state
    }

    *set(setStateInput: SetStateInput<State>): Generator<Optic.OpticErr | CommandOpt, Root> {
        const commandTree = yield* Opt.get(CommandOpt)

        const rootState = this.store.getState()

        const newRootState = yield* Optic.set(rootState, this.optic, function* (state) {
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

        this.store.setState(newRootState)

        return newRootState
    }

    subscribe = (listener: (state: State) => unknown): (() => void) => {
        let previousState: State | DEFAULT_STATE = DEFAULT_STATE
        return this.subscribeResult((result) => {
            if (result.type === 'err') {
                return
            }

            const state = result.value

            const isEqual = shallowEqual(state, previousState)

            previousState = state

            if (!isEqual) {
                listener(state)
            }
        })
    }

    subscribeResult = (listener: (result: Result.Result<State, Optic.OpticErr>) => unknown): (() => void) => {
        const self = this
        return this.store.subscribe((rootState) => {
            const result = Result.run(Optic.get(rootState, self.optic))
            listener(result)
        })
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
