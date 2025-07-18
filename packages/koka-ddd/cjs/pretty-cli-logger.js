'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.PrettyLogger = void 0
var tslib_1 = require('tslib')
var chalk_1 = tslib_1.__importDefault(require('chalk'))
var defaultOptions = {
    colors: true,
    timestamp: true,
    showArgs: true,
    showReturn: true,
    showStates: false,
    showChanges: true,
}
var PrettyLogger = function (options) {
    if (options === void 0) {
        options = {}
    }
    var config = tslib_1.__assign(tslib_1.__assign({}, defaultOptions), options)
    return function (store) {
        store.subscribeExecution(function (tree) {
            var output = formatExecutionTree(tree, config)
            console.log(output)
        })
    }
}
exports.PrettyLogger = PrettyLogger
var formatExecutionTree = function (tree, options) {
    var e_1, _a, e_2, _b, e_3, _c, e_4, _d, e_5, _e
    var lines = []
    var formatLine = function (text, colorFn) {
        if (colorFn === void 0) {
            colorFn = chalk_1.default.white
        }
        return options.colors ? colorFn(text) : text
    }
    var formatHeader = function (tree) {
        var type = tree.type === 'command' ? 'COMMAND' : 'QUERY'
        var colorFn = tree.type === 'command' ? chalk_1.default.green.bold : chalk_1.default.blue.bold
        return formatLine(''.concat(type, ': ').concat(tree.name), colorFn)
    }
    lines.push(formatHeader(tree))
    if (options.showArgs && tree.args.length > 0) {
        lines.push(formatLine('  args: '.concat(JSON.stringify(tree.args)), chalk_1.default.gray))
    }
    if (options.showReturn && tree.return !== undefined) {
        lines.push(formatLine('  return: '.concat(JSON.stringify(tree.return)), chalk_1.default.yellow))
    }
    if (options.showStates && tree.states.length > 0) {
        lines.push(formatLine('  states:', chalk_1.default.gray))
        try {
            for (var _f = tslib_1.__values(tree.states), _g = _f.next(); !_g.done; _g = _f.next()) {
                var state = _g.value
                lines.push(formatLine('    '.concat(JSON.stringify(state)), chalk_1.default.gray))
            }
        } catch (e_1_1) {
            e_1 = { error: e_1_1 }
        } finally {
            try {
                if (_g && !_g.done && (_a = _f.return)) _a.call(_f)
            } finally {
                if (e_1) throw e_1.error
            }
        }
    }
    if (tree.type === 'command' && options.showChanges && tree.changes.length > 0) {
        lines.push(formatLine('  changes:', chalk_1.default.magenta))
        try {
            for (var _h = tslib_1.__values(tree.changes), _j = _h.next(); !_j.done; _j = _h.next()) {
                var change = _j.value
                lines.push(formatLine('    prev: '.concat(JSON.stringify(change.previous)), chalk_1.default.red))
                lines.push(formatLine('    next: '.concat(JSON.stringify(change.next)), chalk_1.default.green))
            }
        } catch (e_2_1) {
            e_2 = { error: e_2_1 }
        } finally {
            try {
                if (_j && !_j.done && (_b = _h.return)) _b.call(_h)
            } finally {
                if (e_2) throw e_2.error
            }
        }
    }
    if (tree.type === 'command') {
        if (tree.commands.length > 0) {
            lines.push(formatLine('  sub-commands:', chalk_1.default.gray))
            try {
                for (var _k = tslib_1.__values(tree.commands), _l = _k.next(); !_l.done; _l = _k.next()) {
                    var subCmd = _l.value
                    lines.push(
                        formatExecutionTree(subCmd, options)
                            .split('\n')
                            .map(function (line) {
                                return '    '.concat(line)
                            })
                            .join('\n'),
                    )
                }
            } catch (e_3_1) {
                e_3 = { error: e_3_1 }
            } finally {
                try {
                    if (_l && !_l.done && (_c = _k.return)) _c.call(_k)
                } finally {
                    if (e_3) throw e_3.error
                }
            }
        }
        if (tree.queries.length > 0) {
            lines.push(formatLine('  queries:', chalk_1.default.gray))
            try {
                for (var _m = tslib_1.__values(tree.queries), _o = _m.next(); !_o.done; _o = _m.next()) {
                    var query = _o.value
                    lines.push(
                        formatExecutionTree(query, options)
                            .split('\n')
                            .map(function (line) {
                                return '    '.concat(line)
                            })
                            .join('\n'),
                    )
                }
            } catch (e_4_1) {
                e_4 = { error: e_4_1 }
            } finally {
                try {
                    if (_o && !_o.done && (_d = _m.return)) _d.call(_m)
                } finally {
                    if (e_4) throw e_4.error
                }
            }
        }
    } else {
        if (tree.queries.length > 0) {
            lines.push(formatLine('  sub-queries:', chalk_1.default.gray))
            try {
                for (var _p = tslib_1.__values(tree.queries), _q = _p.next(); !_q.done; _q = _p.next()) {
                    var subQuery = _q.value
                    lines.push(
                        formatExecutionTree(subQuery, options)
                            .split('\n')
                            .map(function (line) {
                                return '    '.concat(line)
                            })
                            .join('\n'),
                    )
                }
            } catch (e_5_1) {
                e_5 = { error: e_5_1 }
            } finally {
                try {
                    if (_q && !_q.done && (_e = _p.return)) _e.call(_p)
                } finally {
                    if (e_5) throw e_5.error
                }
            }
        }
    }
    return lines.join('\n')
}
//# sourceMappingURL=pretty-cli-logger.js.map
