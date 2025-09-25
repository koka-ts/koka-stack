import { useSyncExternalStore } from 'react'
import * as DDD from 'koka-ddd'
import * as Err from 'koka/err'
import * as Result from 'koka/result'
import * as Accessor from 'koka-accessor'

export function useDomainResult<State, Root>(
    domain: DDD.Domain<State, Root>,
): Result.Result<State, Accessor.AccessorErr> {
    const subscribe = (onStoreChange: () => void) => {
        return DDD.subscribeDomainResult(domain, onStoreChange)
    }

    const getState = () => {
        return DDD.getState(domain)
    }

    const result = useSyncExternalStore(subscribe, getState, getState)

    return result
}

export function useDomainState<State, Root>(domain: DDD.Domain<State, Root>): State {
    const result = useDomainResult(domain)

    if (result.type === 'err') {
        throw result.error
    }

    return result.value
}

export function useDomainQueryResult<Return, Yield extends Err.AnyErr = Err.AnyErr>(
    query: DDD.Query<Return, Yield>,
): Result.Result<Return, Yield> {
    const subscribe = (onStoreChange: () => void) => {
        return DDD.subscribeQueryResult(query, onStoreChange)
    }

    const getState = () => {
        return DDD.getQueryResult(query)
    }

    const result = useSyncExternalStore(subscribe, getState, getState)

    return result
}

export function useDomainQuery<Return, Yield extends Err.AnyErr = Err.AnyErr>(query: DDD.Query<Return, Yield>): Return {
    const result = useDomainQueryResult(query)

    if (result.type === 'err') {
        throw result.error
    }

    return result.value
}
