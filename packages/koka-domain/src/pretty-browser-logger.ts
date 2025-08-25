import { ExecutionTree, Store } from './koka-domain.ts'

type LoggerOptions = {
    colors?: boolean
    timestamp?: boolean
    showArgs?: boolean
    showReturn?: boolean
    showStates?: boolean
    showChanges?: boolean
    groupOutput?: boolean
}

const defaultOptions: LoggerOptions = {
    colors: true,
    timestamp: true,
    showArgs: true,
    showReturn: true,
    showStates: false,
    showChanges: true,
    groupOutput: true,
}

const logExecutionTree = (tree: ExecutionTree, options: LoggerOptions, depth = 0) => {
    const indent = '  '.repeat(depth)

    // 格式化标题
    const type = tree.type === 'command' ? 'COMMAND' : 'QUERY'
    const color = tree.type === 'command' ? '#4CAF50' : '#2196F3'
    const header = `${type}: ${tree.name}`

    if (options.groupOutput && depth === 0) {
        console.groupCollapsed(`%c${header}`, `color: ${color}; font-weight: bold; font-size: 14px`)
    } else {
        console.log(`%c${indent}${header}`, `color: ${color}; font-weight: bold`)
    }

    // 显示参数
    if (options.showArgs && tree.args.length > 0) {
        console.log(`%c${indent}  args:`, 'color: #9E9E9E; font-weight: bold', tree.args)
    }

    // 显示返回值
    if (options.showReturn && tree.return !== undefined) {
        console.log(`%c${indent}  return:`, 'color: #FFC107; font-weight: bold', tree.return)
    }

    // 显示状态（仅查询）
    if (options.showStates && tree.type === 'query' && tree.states.length > 0) {
        console.log(`%c${indent}  states:`, 'color: #9E9E9E; font-weight: bold', tree.states)
    }

    // 显示变更（仅命令）
    if (tree.type === 'command' && options.showChanges && tree.changes.length > 0) {
        console.log(`%c${indent}  changes:`, 'color: #9C27B0; font-weight: bold')
        tree.changes.forEach((change, index) => {
            console.log(`%c${indent}    [${index}] prev:`, 'color: #F44336; font-weight: bold', change.previous)
            console.log(`%c${indent}    [${index}] next:`, 'color: #4CAF50; font-weight: bold', change.next)
        })
    }

    // 处理子命令和查询
    if (tree.type === 'command') {
        if (tree.commands.length > 0) {
            console.log(`%c${indent}  sub-commands:`, 'color: #9E9E9E; font-weight: bold')
            tree.commands.forEach((cmd) => logExecutionTree(cmd, options, depth + 1))
        }
        if (tree.queries.length > 0) {
            console.log(`%c${indent}  queries:`, 'color: #9E9E9E; font-weight: bold')
            tree.queries.forEach((query) => logExecutionTree(query, options, depth + 1))
        }
    } else {
        if (tree.queries.length > 0) {
            console.log(`%c${indent}  sub-queries:`, 'color: #9E9E9E; font-weight: bold')
            tree.queries.forEach((query) => logExecutionTree(query, options, depth + 1))
        }
    }

    if (options.groupOutput && depth === 0) {
        console.groupEnd()
    }
}

export const PrettyLogger = (options: Partial<LoggerOptions> = {}) => {
    const config = { ...defaultOptions, ...options }

    return <State>(store: Store<State>) => {
        store.subscribeExecution((tree) => {
            logExecutionTree(tree, config)
        })
    }
}
