export type Msg<Name extends string, T> = {
    type: 'msg'
    name: Name
    payload: T
}

export type AnyMsg = Msg<string, any>

export function Msg<const Name extends string>(name: Name) {
    return class Eff<T> implements Msg<Name, T> {
        static field: Name = name
        type = 'msg' as const
        name = name
        payload: T
        constructor(payload: T) {
            this.payload = payload
        }
    }
}

export function* send<S extends AnyMsg>(msg: S) {
    yield msg
}

export function* done<S extends AnyMsg>(msg: S) {
    yield msg
}
