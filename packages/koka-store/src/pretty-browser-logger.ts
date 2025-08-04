import { ExecutionTree, Store } from './koka-store.ts'

type LoggerOptions = {
    colors?: boolean
    timestamp?: boolean
    showArgs?: boolean
    showReturn?: boolean
    showStates?: boolean
    showChanges?: boolean
}

const defaultOptions: LoggerOptions = {
    colors: true,
    timestamp: true,
    showArgs: true,
    showReturn: true,
    showStates: false,
    showChanges: true,
}

const logExecutionTree = (tree: ExecutionTree, options: LoggerOptions): string[] => {
    const lines: string[] = []
    const pushLine = (text: string, style = '') => {
        lines.push(`%c${text}${style ? `;${style}` : ''}`)
    }

    const formatHeader = (tree: ExecutionTree) => {
        const type = tree.type === 'command' ? 'COMMAND' : 'QUERY'
        const color = tree.type === 'command' ? '#4CAF50' : '#2196F3'
        pushLine(`${type}: ${tree.name}`, `color: ${color}; font-weight: bold`)
    }

    formatHeader(tree)

    if (options.showArgs && tree.args.length > 0) {
        pushLine('  args:', 'color: #9E9E9E')
        lines.push(JSON.stringify(tree.args))
    }

    if (options.showReturn && tree.return !== undefined) {
        pushLine('  return:', 'color: #FFC107')
        lines.push(JSON.stringify(tree.return))
    }

    if (options.showStates && tree.states.length > 0) {
        pushLine('  states:', 'color: #9E9E9E')
        tree.states.forEach((state) => {
            pushLine('    ', 'color: #9E9E9E')
            lines.push(JSON.stringify(state))
        })
    }

    if (tree.type === 'command' && options.showChanges && tree.changes.length > 0) {
        pushLine('  changes:', 'color: #9C27B0')
        tree.changes.forEach((change) => {
            pushLine('    prev:', 'color: #F44336')
            lines.push(JSON.stringify(change.previous))
            pushLine('    next:', 'color: #4CAF50')
            lines.push(JSON.stringify(change.next))
        })
    }

    const processSubTree = (subTree: ExecutionTree, prefix: string) => {
        const subLines = logExecutionTree(subTree, options)
        subLines.forEach((line) => {
            if (line.startsWith('%c')) {
                lines.push(`%c${prefix}${line.slice(2)}`)
            } else {
                lines.push(`${prefix}${line}`)
            }
        })
    }

    if (tree.type === 'command') {
        if (tree.commands.length > 0) {
            pushLine('  sub-commands:', 'color: #9E9E9E')
            tree.commands.forEach((cmd) => processSubTree(cmd, '    '))
        }
        if (tree.queries.length > 0) {
            pushLine('  queries:', 'color: #9E9E9E')
            tree.queries.forEach((query) => processSubTree(query, '    '))
        }
    } else {
        if (tree.queries.length > 0) {
            pushLine('  sub-queries:', 'color: #9E9E9E')
            tree.queries.forEach((query) => processSubTree(query, '    '))
        }
    }

    return lines
}

export const PrettyLogger = (options: Partial<LoggerOptions> = {}) => {
    const config = { ...defaultOptions, ...options }

    return <State>(store: Store<State>) => {
        store.subscribeExecution((tree) => {
            const lines = logExecutionTree(tree, config)
            lines.forEach((line, i) => {
                if (line.startsWith('%c')) {
                    const [style, ...content] = line.slice(2).split(';')
                    console.log(line, ...content)
                } else {
                    console.log(line)
                }
            })
        })
    }
}
