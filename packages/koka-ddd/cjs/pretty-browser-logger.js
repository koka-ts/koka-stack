'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.PrettyLogger = void 0
var tslib_1 = require('tslib')
var defaultOptions = {
    colors: true,
    timestamp: true,
    showArgs: true,
    showReturn: true,
    showStates: false,
    showChanges: true,
}
var logExecutionTree = function (tree, options) {
    var lines = []
    var pushLine = function (text, style) {
        if (style === void 0) {
            style = ''
        }
        lines.push('%c'.concat(text).concat(style ? ';'.concat(style) : ''))
    }
    var formatHeader = function (tree) {
        var type = tree.type === 'command' ? 'COMMAND' : 'QUERY'
        var color = tree.type === 'command' ? '#4CAF50' : '#2196F3'
        pushLine(''.concat(type, ': ').concat(tree.name), 'color: '.concat(color, '; font-weight: bold'))
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
        tree.states.forEach(function (state) {
            pushLine('    ', 'color: #9E9E9E')
            lines.push(JSON.stringify(state))
        })
    }
    if (tree.type === 'command' && options.showChanges && tree.changes.length > 0) {
        pushLine('  changes:', 'color: #9C27B0')
        tree.changes.forEach(function (change) {
            pushLine('    prev:', 'color: #F44336')
            lines.push(JSON.stringify(change.previous))
            pushLine('    next:', 'color: #4CAF50')
            lines.push(JSON.stringify(change.next))
        })
    }
    var processSubTree = function (subTree, prefix) {
        var subLines = logExecutionTree(subTree, options)
        subLines.forEach(function (line) {
            if (line.startsWith('%c')) {
                lines.push('%c'.concat(prefix).concat(line.slice(2)))
            } else {
                lines.push(''.concat(prefix).concat(line))
            }
        })
    }
    if (tree.type === 'command') {
        if (tree.commands.length > 0) {
            pushLine('  sub-commands:', 'color: #9E9E9E')
            tree.commands.forEach(function (cmd) {
                return processSubTree(cmd, '    ')
            })
        }
        if (tree.queries.length > 0) {
            pushLine('  queries:', 'color: #9E9E9E')
            tree.queries.forEach(function (query) {
                return processSubTree(query, '    ')
            })
        }
    } else {
        if (tree.queries.length > 0) {
            pushLine('  sub-queries:', 'color: #9E9E9E')
            tree.queries.forEach(function (query) {
                return processSubTree(query, '    ')
            })
        }
    }
    return lines
}
var PrettyLogger = function (options) {
    if (options === void 0) {
        options = {}
    }
    var config = tslib_1.__assign(tslib_1.__assign({}, defaultOptions), options)
    return function (store) {
        store.subscribeExecution(function (tree) {
            var lines = logExecutionTree(tree, config)
            lines.forEach(function (line, i) {
                if (line.startsWith('%c')) {
                    var _a = tslib_1.__read(line.slice(2).split(';')),
                        style = _a[0],
                        content = _a.slice(1)
                    console.log.apply(console, tslib_1.__spreadArray([line], tslib_1.__read(content), false))
                } else {
                    console.log(line)
                }
            })
        })
    }
}
exports.PrettyLogger = PrettyLogger
//# sourceMappingURL=pretty-browser-logger.js.map
