'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.prettyPrintExecutionTree = exports.PrettyPrinter = void 0
var tslib_1 = require('tslib')
var PrettyPrinter = function () {
    return function (store) {
        store.subscribeExecution(function (tree) {
            var output = (0, exports.prettyPrintExecutionTree)(tree)
            console.log(output)
        })
    }
}
exports.PrettyPrinter = PrettyPrinter
var prettyPrintExecutionTree = function (tree) {
    var treeLines = []
    var formatTree = function (node, indent) {
        var e_1, _a, e_2, _b, e_3, _c, e_4, _d, e_5, _e
        if (indent === void 0) {
            indent = 0
        }
        var spaces = ' '.repeat(indent * 2)
        treeLines.push(
            ''
                .concat(spaces)
                .concat(node.type === 'command' ? 'Command' : 'Query', ': ')
                .concat(node.name),
        )
        if (node.args.length > 0) {
            treeLines.push(''.concat(spaces, 'Args: ').concat(JSON.stringify(node.args)))
        }
        if (node.return !== undefined) {
            treeLines.push(''.concat(spaces, 'Return: ').concat(JSON.stringify(node.return)))
        }
        if (node.states.length > 0) {
            treeLines.push(''.concat(spaces, 'States:'))
            try {
                for (var _f = tslib_1.__values(node.states), _g = _f.next(); !_g.done; _g = _f.next()) {
                    var state = _g.value
                    treeLines.push(''.concat(spaces, '  State: ').concat(JSON.stringify(state)))
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
        if (node.type === 'command' && node.changes.length > 0) {
            treeLines.push(''.concat(spaces, 'State Changes:'))
            try {
                for (var _h = tslib_1.__values(node.changes), _j = _h.next(); !_j.done; _j = _h.next()) {
                    var change = _j.value
                    treeLines.push(''.concat(spaces, '  Previous: ').concat(JSON.stringify(change.previous)))
                    treeLines.push(''.concat(spaces, '  Next: ').concat(JSON.stringify(change.next)))
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
        if (node.type === 'command') {
            if (node.commands.length > 0) {
                treeLines.push(''.concat(spaces, 'Sub-Commands:'))
                try {
                    for (var _k = tslib_1.__values(node.commands), _l = _k.next(); !_l.done; _l = _k.next()) {
                        var subCmd = _l.value
                        formatTree(subCmd, indent + 1)
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
            if (node.queries.length > 0) {
                treeLines.push(''.concat(spaces, 'Queries:'))
                try {
                    for (var _m = tslib_1.__values(node.queries), _o = _m.next(); !_o.done; _o = _m.next()) {
                        var query = _o.value
                        formatTree(query, indent + 1)
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
            if (node.queries.length > 0) {
                treeLines.push(''.concat(spaces, 'Sub-Queries:'))
                try {
                    for (var _p = tslib_1.__values(node.queries), _q = _p.next(); !_q.done; _q = _p.next()) {
                        var subQuery = _q.value
                        formatTree(subQuery, indent + 1)
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
    }
    formatTree(tree)
    return treeLines.join('\n')
}
exports.prettyPrintExecutionTree = prettyPrintExecutionTree
//# sourceMappingURL=pretty-printer.js.map
