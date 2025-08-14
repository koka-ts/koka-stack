import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import * as DDD from 'koka-ddd'
import * as Result from 'koka/result'
import * as Optic from 'koka-optic'

export type StoreProviderComponentProps<Root> = {
    domain: DDD.Domain<Root, Root>
}

export interface StoreProviderProps<Root> {
    store: DDD.Store<Root>
    Component: (props: StoreProviderComponentProps<Root>) => ReactNode
}

const StoreContext = createContext<DDD.AnyStore | null>(null)

export function StoreProvider<Root>(props: StoreProviderProps<Root>) {
    return (
        <StoreContext.Provider value={props.store}>
            <props.Component domain={props.store.domain} />
        </StoreContext.Provider>
    )
}

export function useStore<Root>(): DDD.Store<Root> {
    const store = useContext(StoreContext)
    if (!store) {
        throw new Error('useStore must be used within a StoreProvider')
    }
    return store as DDD.Store<Root>
}

export function useStoreState<State>(): State {
    const store = useStore<State>()

    return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

export function useDomainResult<State, Root>(domain: DDD.Domain<State, Root>): Result.Result<State, Optic.OpticErr> {
    const result = useSyncExternalStore(domain.subscribe, domain.getState, domain.getState)

    return result
}

export function useDomainState<State, Root>(domain: DDD.Domain<State, Root>): State {
    const result = useDomainResult(domain)

    if (result.type === 'err') {
        throw result.error
    }

    return result.value
}

export type DomainStateSelector<State, Target> = (state: State) => Target

export function useDomainSelector<State, Root, Target>(
    domain: DDD.Domain<State, Root>,
    selector: DomainStateSelector<State, Target>,
): Target {
    const result = useDomainResult(domain)

    if (result.type === 'err') {
        throw result.error
    }

    return selector(result.value)
}
