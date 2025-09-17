import { ExecutionTree, CommandExecutionTree, QueryExecutionTree, Store } from './koka-domain.js'
import chalk from 'chalk'

type LoggerOptions = {
    colors?: boolean
    timestamp?: boolean
    showArgs?: boolean
    showReturn?: boolean
    showStates?: boolean
    showChanges?: boolean
    maxDepth?: number
    compactMode?: boolean
}

const defaultOptions: LoggerOptions = {
    colors: true,
    timestamp: true,
    showArgs: true,
    showReturn: true,
    showStates: false,
    showChanges: true,
    maxDepth: 10,
    compactMode: false,
}

// 树状结构字符
const TREE_CHARS = {
    VERTICAL: '│',
    HORIZONTAL: '─',
    BRANCH: '├',
    LAST_BRANCH: '└',
    CORNER: '└',
    TEE: '├',
    CROSS: '┼',
    SPACE: '  ',
}

// 图标
const ICONS = {
    COMMAND: '⚡',
    QUERY: '🔍',
    ASYNC: '⏳',
    SUCCESS: '✓',
    ERROR: '✗',
    ARROW: '→',
    CHANGE: '∆',
    STATE: '📊',
}

export const PrettyLogger = (options: Partial<LoggerOptions> = {}) => {
    const config = { ...defaultOptions, ...options }

    return <State>(store: Store<State>) => {
        store.subscribeExecution((tree) => {
            const output = formatExecutionTree(tree, config)
            console.log(output)
        })
    }
}

// 格式化值，智能处理不同类型
const formatValue = (value: unknown, maxLength: number = 80): string => {
    if (value === undefined) return 'undefined'
    if (value === null) return 'null'
    
    const stringified = JSON.stringify(value)
    if (stringified.length <= maxLength) {
        return stringified
    }
    
    // 对于长字符串，进行截断
    if (typeof value === 'string') {
        return `"${value.substring(0, maxLength - 5)}..."`
    }
    
    // 对于对象和数组，显示摘要
    if (Array.isArray(value)) {
        return `[Array(${value.length})]`
    }
    
    if (typeof value === 'object') {
        const keys = Object.keys(value)
        return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`
    }
    
    return stringified.substring(0, maxLength - 3) + '...'
}

// 主格式化函数
const formatExecutionTree = (
    tree: ExecutionTree,
    options: LoggerOptions,
    depth: number = 0,
    isLast: boolean = true,
    prefix: string = ''
): string => {
    const lines: string[] = []
    
    // 超过最大深度时，显示省略
    if (options.maxDepth && depth > options.maxDepth) {
        return options.colors ? chalk.gray('...') : '...'
    }
    
    const applyColor = (text: string, colorFn: chalk.Chalk) => 
        options.colors ? colorFn(text) : text
    
    // 创建当前层级的前缀
    const currentPrefix = depth === 0 ? '' : prefix + (isLast ? TREE_CHARS.LAST_BRANCH : TREE_CHARS.BRANCH) + TREE_CHARS.HORIZONTAL
    const childPrefix = depth === 0 ? '' : prefix + (isLast ? TREE_CHARS.SPACE : TREE_CHARS.VERTICAL) + ' '
    
    // 格式化头部
    const formatHeader = () => {
        const icon = tree.type === 'command' ? ICONS.COMMAND : ICONS.QUERY
        const asyncIcon = tree.async ? ICONS.ASYNC : ''
        const typeLabel = tree.type === 'command' ? 'CMD' : 'QRY'
        const typeColor = tree.type === 'command' ? chalk.green : chalk.cyan
        
        let header = currentPrefix
        
        if (options.timestamp && depth === 0) {
            header += applyColor(`[${new Date().toISOString()}] `, chalk.gray)
        }
        
        header += applyColor(`${icon} ${typeLabel}`, typeColor.bold)
        header += applyColor(' ' + asyncIcon, chalk.yellow)
        header += ' '
        header += applyColor(tree.name, typeColor)
        
        return header
    }
    
    lines.push(formatHeader())
    
    // 格式化参数
    if (options.showArgs && tree.args.length > 0) {
        const argsLine = childPrefix + applyColor(`  ${ICONS.ARROW} Args: `, chalk.gray)
        if (options.compactMode) {
            lines.push(argsLine + applyColor(tree.args.map(arg => formatValue(arg, 40)).join(', '), chalk.white))
        } else {
            lines.push(argsLine)
            tree.args.forEach((arg, index) => {
                lines.push(childPrefix + applyColor(`    [${index}]: `, chalk.gray) + formatValue(arg))
            })
        }
    }
    
    // 格式化返回值
    if (options.showReturn && tree.return !== undefined) {
        const returnIcon = tree.return instanceof Error ? ICONS.ERROR : ICONS.SUCCESS
        const returnColor = tree.return instanceof Error ? chalk.red : chalk.green
        lines.push(
            childPrefix + applyColor(`  ${returnIcon} Return: `, returnColor) + 
            formatValue(tree.return)
        )
    }
    
    // 格式化状态（仅查询）
    if (options.showStates && tree.states.length > 0) {
        lines.push(childPrefix + applyColor(`  ${ICONS.STATE} States:`, chalk.magenta))
        tree.states.forEach((state, index) => {
            lines.push(
                childPrefix + applyColor(`    [${index}]: `, chalk.gray) + 
                formatValue(state, 60)
            )
        })
    }
    
    // 格式化变更（仅命令）
    if (tree.type === 'command' && options.showChanges && tree.changes.length > 0) {
        lines.push(childPrefix + applyColor(`  ${ICONS.CHANGE} Changes:`, chalk.yellow.bold))
        tree.changes.forEach((change, index) => {
            if (options.compactMode) {
                lines.push(
                    childPrefix + applyColor(`    [${index}]: `, chalk.gray) +
                    applyColor(formatValue(change.previous, 30), chalk.red) +
                    applyColor(' → ', chalk.yellow) +
                    applyColor(formatValue(change.next, 30), chalk.green)
                )
            } else {
                lines.push(childPrefix + applyColor(`    Change [${index}]:`, chalk.gray))
                lines.push(childPrefix + applyColor('      Before: ', chalk.red) + formatValue(change.previous))
                lines.push(childPrefix + applyColor('      After:  ', chalk.green) + formatValue(change.next))
            }
        })
    }
    
    // 处理子命令和查询
    const processChildren = (children: ExecutionTree[], label: string, icon: string) => {
        if (children.length > 0) {
            lines.push(childPrefix + applyColor(`  ${icon} ${label} (${children.length}):`, chalk.blue))
            children.forEach((child, index) => {
                const isLastChild = index === children.length - 1
                const childLines = formatExecutionTree(
                    child,
                    options,
                    depth + 1,
                    isLastChild,
                    childPrefix + '  '
                )
                lines.push(childLines)
            })
        }
    }
    
    if (tree.type === 'command') {
        const cmdTree = tree as CommandExecutionTree
        processChildren(cmdTree.commands, 'Sub-Commands', '📁')
        processChildren(cmdTree.queries, 'Queries', '🔎')
    } else {
        const queryTree = tree as QueryExecutionTree
        processChildren(queryTree.queries, 'Sub-Queries', '🔎')
    }
    
    return lines.join('\n')
}
