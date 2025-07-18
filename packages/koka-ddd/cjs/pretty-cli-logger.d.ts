import { Store } from './koka-ddd'
type LoggerOptions = {
    colors?: boolean
    timestamp?: boolean
    showArgs?: boolean
    showReturn?: boolean
    showStates?: boolean
    showChanges?: boolean
}
export declare const PrettyLogger: (options?: Partial<LoggerOptions>) => <State>(store: Store<State>) => void
export {}
