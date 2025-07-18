import { ExecutionTree, Store } from './koka-ddd'
export declare const PrettyPrinter: () => <State>(store: Store<State>) => void
export declare const prettyPrintExecutionTree: (tree: ExecutionTree) => string
