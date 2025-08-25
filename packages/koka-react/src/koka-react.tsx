import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import * as Domain from 'koka-domain'
import * as Result from 'koka/result'
import * as Optic from 'koka-optic'

export type StoreProviderComponentProps<Root> = {
    domain: Domain.Domain<Root, Root>
}

export interface StoreProviderProps<Root> {
    store: Domain.Store<Root>
    Component: (props: StoreProviderComponentProps<Root>) => ReactNode
}

const StoreContext = createContext<Domain.AnyStore | null>(null)

export function StoreProvider<Root>(props: StoreProviderProps<Root>) {
    return (
        <StoreContext.Provider value={props.store}>
            <props.Component domain={props.store.domain} />
        </StoreContext.Provider>
    )
}

export function useStore<Root>(): Domain.Store<Root> {
    const store = useContext(StoreContext)
    if (!store) {
        throw new Error('useStore must be used within a StoreProvider')
    }
    return store as Domain.Store<Root>
}

export function useStoreState<State>(): State {
    const store = useStore<State>()

    return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

export function useDomainResult<State, Root>(domain: Domain.Domain<State, Root>): Result.Result<State, Optic.OpticErr> {
    const subscribe = (onStoreChange: () => void) => {
        return Domain.subscribeDomainResult(domain, onStoreChange)
    }

    const getState = () => {
        return Domain.getState(domain)
    }

    const result = useSyncExternalStore(subscribe, getState, getState)

    return result
}

export function useDomainState<State, Root>(domain: Domain.Domain<State, Root>): State {
    const result = useDomainResult(domain)

    if (result.type === 'err') {
        throw result.error
    }

    return result.value
}

export type DomainStateSelector<State, Target> = (state: State) => Target

export function useDomainSelector<State, Root, Target>(
    domain: Domain.Domain<State, Root>,
    selector: DomainStateSelector<State, Target>,
): Target {
    const result = useDomainResult(domain)

    if (result.type === 'err') {
        throw result.error
    }

    return selector(result.value)
}
