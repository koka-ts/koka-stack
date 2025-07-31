import { EffSymbol } from './constant'

export type Opt<Name extends string, T> = {
    type: 'opt'
    name: Name
    context: EffSymbol | T
    optional?: true
}

export type AnyOpt = Opt<string, any>

export function Opt<const Name extends string>(name: Name) {
    return class Eff<T> {
        static field: Name = name
        type = 'opt' as const
        name = name
        context = EffSymbol as EffSymbol | T
        optional?: true
    }
}

export type OptValue<C extends AnyOpt> = C['optional'] extends true
    ? Exclude<C['context'], EffSymbol> | undefined
    : Exclude<C['context'], EffSymbol>

export function* get<O extends AnyOpt>(opt: O | (new () => O)): Generator<O, OptValue<O>> {
    const optValue = yield typeof opt === 'function' ? new opt() : opt

    return optValue as OptValue<O>
}
