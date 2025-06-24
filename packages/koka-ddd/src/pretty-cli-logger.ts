import { ExecutionTree, Store } from './koka-ddd'
import chalk from 'chalk'

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

export const PrettyLogger = (options: Partial<LoggerOptions> = {}) => {
    const config = { ...defaultOptions, ...options }

    return <State>(store: Store<State>) => {
        store.subscribeExecution((tree) => {
            const output = formatExecutionTree(tree, config)
            console.log(output)
        })
    }
}

const formatExecutionTree = (tree: ExecutionTree, options: LoggerOptions): string => {
    const lines: string[] = []

    const formatLine = (text: string, colorFn: (s: string) => string = chalk.white) => {
        return options.colors ? colorFn(text) : text
    }

    const formatHeader = (tree: ExecutionTree) => {
        const type = tree.type === 'command' ? 'COMMAND' : 'QUERY'
        const colorFn = tree.type === 'command' ? chalk.green.bold : chalk.blue.bold
        return formatLine(`${type}: ${tree.name}`, colorFn)
    }

    lines.push(formatHeader(tree))

    if (options.showArgs && tree.args.length > 0) {
        lines.push(formatLine(`  args: ${JSON.stringify(tree.args)}`, chalk.gray))
    }

    if (options.showReturn && tree.return !== undefined) {
        lines.push(formatLine(`  return: ${JSON.stringify(tree.return)}`, chalk.yellow))
    }

    if (options.showStates && tree.states.length > 0) {
        lines.push(formatLine('  states:', chalk.gray))
        for (const state of tree.states) {
            lines.push(formatLine(`    ${JSON.stringify(state)}`, chalk.gray))
        }
    }

    if (tree.type === 'command' && options.showChanges && tree.changes.length > 0) {
        lines.push(formatLine('  changes:', chalk.magenta))
        for (const change of tree.changes) {
            lines.push(formatLine(`    prev: ${JSON.stringify(change.previous)}`, chalk.red))
            lines.push(formatLine(`    next: ${JSON.stringify(change.next)}`, chalk.green))
        }
    }

    if (tree.type === 'command') {
        if (tree.commands.length > 0) {
            lines.push(formatLine('  sub-commands:', chalk.gray))
            for (const subCmd of tree.commands) {
                lines.push(
                    formatExecutionTree(subCmd, options)
                        .split('\n')
                        .map((line) => `    ${line}`)
                        .join('\n'),
                )
            }
        }
        if (tree.queries.length > 0) {
            lines.push(formatLine('  queries:', chalk.gray))
            for (const query of tree.queries) {
                lines.push(
                    formatExecutionTree(query, options)
                        .split('\n')
                        .map((line) => `    ${line}`)
                        .join('\n'),
                )
            }
        }
    } else {
        if (tree.queries.length > 0) {
            lines.push(formatLine('  sub-queries:', chalk.gray))
            for (const subQuery of tree.queries) {
                lines.push(
                    formatExecutionTree(subQuery, options)
                        .split('\n')
                        .map((line) => `    ${line}`)
                        .join('\n'),
                )
            }
        }
    }

    return lines.join('\n')
}
