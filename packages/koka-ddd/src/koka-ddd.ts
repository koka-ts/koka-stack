import { Ctx, Eff, AnyErr, Async, MaybePromise, Result, AnyEff, AnyCtx } from 'koka'
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

export type GetRoot<Root> = Ctx<'getRoot', () => Root>

export type SetRoot<Root> = Ctx<'setRoot', (Root: Root) => void>

export type QueryEff<Root> = OpticErr | GetRoot<Root>

export type RootAccessor<Root> = GetRoot<Root> | SetRoot<Root>

export type CommandStack = {
    parent?: CommandStack
    name: string
    args: unknown[]
    return: unknown
    states: { previous: unknown; next: unknown }[]
    stacks: CommandStack[]
}

export type CommandStackEff = Ctx<'commandStack', CommandStack>

export type CommandEff<Root> = OpticErr | RootAccessor<Root> | CommandStackEff

export type StoreOptions<State> = {
    state: State
}

export type MaybeFunction<T> = T | (() => T)

export type DomainQuery<Return, Root, E extends AnyEff = never> = Generator<QueryEff<Root> | E, Return>

export type DomainCommand<Return, Root, E extends AnyEff = never> = Generator<CommandEff<Root> | E, Return>

export function* get<State, Root>(domainOrOptic: Domain<State, Root> | Optic<State, Root>): DomainQuery<State, Root> {
    const optic = domainOrOptic instanceof Domain ? domainOrOptic.$ : domainOrOptic

    const getRoot = yield* Eff.ctx('getRoot').get<() => Root>()

    const root = getRoot()

    const State = yield* optic.get(root)

    return State
}

export function* set<State, Root>(
    domainOrOptic: Domain<State, Root> | Optic<State, Root>,
    setStateInput: SetStateInput<State>,
): DomainCommand<void, Root> {
    const optic = domainOrOptic instanceof Domain ? domainOrOptic.$ : domainOrOptic

    const commandStack = yield* Eff.ctx('commandStack').get<CommandStack>()

    const updateRoot = optic.set(function* (state) {
        if (typeof setStateInput !== 'function') {
            commandStack.states.push({
                previous: state,
                next: setStateInput,
            })
            return setStateInput
        }

        const result = (setStateInput as Updater<State> | ((state: State) => State))(state)

        const nextState = yield* getOpticValue(result)

        commandStack.states.push({
            previous: state,
            next: nextState,
        })

        return nextState
    })

    const getRoot = yield* Eff.ctx('getRoot').get<() => Root>()

    const root = getRoot()

    const newRoot = yield* updateRoot(root)

    const setRoot = yield* Eff.ctx('setRoot').get<(Root: Root) => void>()

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
    ): typeof target {
        const methodName = context.name

        function replacementMethod(this: This, ...args: Args) {
            console.log(`LOG COMMAND: Entering method '${methodName}'.`)
            const result = target.call(this, ...args)
            console.log(`LOG COMMAND: Exiting method '${methodName}'.`)
            return result
        }

        return replacementMethod
    }
}

export function command() {
    return function <This, Args extends any[], Root, Return, E extends AnyEff>(
        target: (this: This, ...args: Args) => Generator<E, Return>,
        context: KokaClassMethodDecoratorContext<This, typeof target>,
    ): typeof target {
        const methodName = context.name

        function* replacementMethod(this: This, ...args: Args) {
            // const parent = yield* Eff.ctx('commandStack').get<CommandStack>()

            const commandStack: CommandStack = {
                // parent: parent,
                name: methodName,
                args: [],
                return: undefined,
                states: [],
                stacks: [],
            }

            const result = yield* Eff.try(target.call(this, ...args)).catch({
                commandStack,
            })

            return result
        }

        return replacementMethod
    }
}

export type StoreContext = Record<string, unknown>

type ToCtxEff<T extends StoreContext> = {
    [K in keyof T]: K extends string ? Ctx<K, T[K]> : never
}[keyof T]

export class Store<State> {
    state: State

    context: StoreContext = {}

    constructor(options: StoreOptions<State>) {
        this.state = options.state
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

    private listeners: ((state: State) => void)[] = []

    subscribe(listener: (state: State) => void): () => void {
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
        const withRoot = Eff.try(query as Generator<GetRoot<State>, T>).catch({
            getRoot: this.getState,
            ...this.context,
        })

        return Eff.runResult(withRoot) as any
    }

    runCommand<T, E extends CommandEff<State> | AnyErr | Async | ToCtxEff<this['context']>>(
        input: MaybeFunction<Generator<E, T>>,
    ): Async extends E ? MaybePromise<Result<T, E>> : Result<T, E> {
        const command = typeof input === 'function' ? input() : input
        const withRoot = Eff.try(command as Generator<RootAccessor<State>, any>).catch({
            setRoot: this.setState,
            getRoot: this.getState,
            ...this.context,
        })

        try {
            return Eff.runResult(withRoot) as any
        } finally {
            this.publish()
        }
    }
}
