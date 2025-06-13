import { Err } from 'koka'
export type OpticErr = Err<'OpticErr', string>
export type Getter<State, Root> = (root: Root) => Generator<OpticErr, State, unknown>
export type Updater<State> = (state: State) => Generator<OpticErr, State, unknown>
export type Setter<State, Root> = (updater: Updater<State>) => Updater<Root>
export type OpticOptions<State, Root> = {
    get: Getter<State, Root>
    set: Setter<State, Root>
}
type ArrayItem<T> = T extends (infer U)[] | readonly (infer U)[] ? U : never
export type GetKey<T> = (item: ArrayItem<T>) => string | number
export type MaybeOpticEff<T> = T | Generator<OpticErr, T, unknown>
export declare function getOpticValue<T>(value: MaybeOpticEff<T>): Generator<OpticErr, T, unknown>
export type Selector<Target, State> = {
    get: (state: State) => MaybeOpticEff<Target>
    set: (target: Target, state: State) => MaybeOpticEff<State>
}
export type InferOpticState<T> = T extends Optic<infer State, any> ? State : never
export type InferOpticRoot<T> = T extends Optic<any, infer Root> ? Root : never
export type AnyOptic = Optic<any, any>
export type NestedArray<T> = Array<T | NestedArray<T>>
export type NestedReadonlyArray<T> = ReadonlyArray<T | NestedReadonlyArray<T>>
export declare class Optic<State, Root> {
    static root<Root>(): Optic<Root, Root>
    static object<T extends Record<string, AnyOptic>>(
        optics: T,
    ): Optic<
        {
            [K in keyof T]: InferOpticState<T[K]>
        },
        InferOpticRoot<T[keyof T]>
    >
    static optional<State, Root>(optic: Optic<State, Root>): Optic<State | undefined, Root>
    __type: 'KokaOptic'
    get: Getter<State, Root>
    set: Setter<State, Root>
    constructor(options: OpticOptions<State, Root>)
    toJSON(): undefined
    select<Target>(selector: Selector<Target, State>): Optic<Target, Root>
    prop<Key extends keyof State & string>(key: Key): Optic<State[Key], Root>
    index<Index extends keyof State & number>(index: Index): Optic<State[Index], Root>
    find<Target extends ArrayItem<State>>(
        predicate:
            | ((item: ArrayItem<State>, index: number) => boolean)
            | ((item: ArrayItem<State>, index: number) => item is Target),
    ): Optic<Target, Root>
    match<Matched extends State>(predicate: (state: State) => state is Matched): Optic<Matched, Root>
    refine(predicate: (state: State) => boolean): Optic<State, Root>
    as<Refined>(): Optic<Refined, Root>
    map<Target>(
        mapper:
            | Selector<Target, ArrayItem<State>>
            | Optic<Target, ArrayItem<State>>
            | ((state: Optic<ArrayItem<State>, ArrayItem<State>>) => Optic<Target, ArrayItem<State>>),
    ): Optic<Target[], Root>
    getKey?: GetKey<State>
    filter<Target extends ArrayItem<State>>(
        predicate:
            | ((item: ArrayItem<State>, index: number) => boolean)
            | ((item: ArrayItem<State>, index: number) => item is Target),
    ): Optic<Target[], Root>
}
export {}
