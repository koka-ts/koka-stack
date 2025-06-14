'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.Store = exports.prettyPrintCommandStack = exports.Domain = void 0
exports.get = get
exports.set = set
exports.query = query
exports.command = command
var tslib_1 = require('tslib')
var koka_1 = require('koka')
var koka_optic_1 = require('koka-optic')
tslib_1.__exportStar(require('koka-optic'), exports)
var Domain = /** @class */ (function () {
    function Domain(options) {
        var _this = this
        this.$ = new koka_optic_1.Optic(options)
        Object.defineProperty(this.$, 'getKey', {
            get: function () {
                return _this.getKey
            },
        })
    }
    return Domain
})()
exports.Domain = Domain
var prettyPrintCommandStack = function (commandStack) {
    var stackLines = []
    var formatStack = function (stack, indent) {
        var e_1, _a, e_2, _b
        if (indent === void 0) {
            indent = 0
        }
        var spaces = ' '.repeat(indent * 2)
        stackLines.push(''.concat(spaces, 'Command: ').concat(stack.name))
        if (stack.args.length > 0) {
            stackLines.push(''.concat(spaces, 'Args: ').concat(JSON.stringify(stack.args)))
        }
        if (stack.return !== undefined) {
            stackLines.push(''.concat(spaces, 'Return: ').concat(JSON.stringify(stack.return)))
        }
        if (stack.states.length > 0) {
            stackLines.push(''.concat(spaces, 'States:'))
            try {
                for (var _c = tslib_1.__values(stack.states), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var state = _d.value
                    stackLines.push(''.concat(spaces, '  Previous: ').concat(JSON.stringify(state.previous)))
                    stackLines.push(''.concat(spaces, '  Next: ').concat(JSON.stringify(state.next)))
                }
            } catch (e_1_1) {
                e_1 = { error: e_1_1 }
            } finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c)
                } finally {
                    if (e_1) throw e_1.error
                }
            }
        }
        if (stack.stacks.length > 0) {
            stackLines.push(''.concat(spaces, 'Sub-Commands:'))
            try {
                for (var _e = tslib_1.__values(stack.stacks), _f = _e.next(); !_f.done; _f = _e.next()) {
                    var subStack = _f.value
                    formatStack(subStack, indent + 1)
                }
            } catch (e_2_1) {
                e_2 = { error: e_2_1 }
            } finally {
                try {
                    if (_f && !_f.done && (_b = _e.return)) _b.call(_e)
                } finally {
                    if (e_2) throw e_2.error
                }
            }
        }
    }
    if (commandStack.name === '') {
        commandStack.stacks.forEach(formatStack)
    } else {
        formatStack(commandStack)
    }
    return stackLines.join('\n')
}
exports.prettyPrintCommandStack = prettyPrintCommandStack
function get(domainOrOptic) {
    var optic, getRoot, root, State
    return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                optic = domainOrOptic instanceof Domain ? domainOrOptic.$ : domainOrOptic
                return [5 /*yield**/, tslib_1.__values(koka_1.Eff.ctx('getRoot').get())]
            case 1:
                getRoot = _a.sent()
                root = getRoot()
                return [5 /*yield**/, tslib_1.__values(optic.get(root))]
            case 2:
                State = _a.sent()
                return [2 /*return*/, State]
        }
    })
}
function set(domainOrOptic, setStateInput) {
    var optic, commandStack, updateRoot, getRoot, root, newRoot, setRoot
    return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                optic = domainOrOptic instanceof Domain ? domainOrOptic.$ : domainOrOptic
                return [5 /*yield**/, tslib_1.__values(koka_1.Eff.ctx('commandStack').get())]
            case 1:
                commandStack = _a.sent()
                updateRoot = optic.set(function (state) {
                    var result, nextState
                    return tslib_1.__generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (typeof setStateInput !== 'function') {
                                    commandStack === null || commandStack === void 0
                                        ? void 0
                                        : commandStack.states.push({
                                              previous: state,
                                              next: setStateInput,
                                          })
                                    return [2 /*return*/, setStateInput]
                                }
                                result = setStateInput(state)
                                return [5 /*yield**/, tslib_1.__values((0, koka_optic_1.getOpticValue)(result))]
                            case 1:
                                nextState = _a.sent()
                                commandStack === null || commandStack === void 0
                                    ? void 0
                                    : commandStack.states.push({
                                          previous: state,
                                          next: nextState,
                                      })
                                return [2 /*return*/, nextState]
                        }
                    })
                })
                return [5 /*yield**/, tslib_1.__values(koka_1.Eff.ctx('getRoot').get())]
            case 2:
                getRoot = _a.sent()
                root = getRoot()
                return [5 /*yield**/, tslib_1.__values(updateRoot(root))]
            case 3:
                newRoot = _a.sent()
                return [5 /*yield**/, tslib_1.__values(koka_1.Eff.ctx('setRoot').get())]
            case 4:
                setRoot = _a.sent()
                setRoot(newRoot)
                return [2 /*return*/]
        }
    })
}
function query() {
    return function (target, context) {
        var methodName = context.name
        function replacementMethod() {
            var args = []
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i]
            }
            console.log("LOG COMMAND: Entering method '".concat(methodName, "'."))
            var result = target.call.apply(target, tslib_1.__spreadArray([this], tslib_1.__read(args), false))
            console.log("LOG COMMAND: Exiting method '".concat(methodName, "'."))
            return result
        }
        return replacementMethod
    }
}
function command() {
    return function (target, context) {
        var methodName = context.name
        function replacementMethod() {
            var _i, parent, name, commandStack, result
            var _a, _b
            var args = []
            for (_i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i]
            }
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        return [5 /*yield**/, tslib_1.__values(koka_1.Eff.ctx('commandStack').get())]
                    case 1:
                        parent = _c.sent()
                        name = ''
                            .concat(
                                (_b = (_a = this.constructor) === null || _a === void 0 ? void 0 : _a.name) !== null &&
                                    _b !== void 0
                                    ? _b
                                    : 'UnknownDomain',
                                '.',
                            )
                            .concat(methodName)
                        commandStack = {
                            name: name,
                            async: false,
                            args: args,
                            return: undefined,
                            states: [],
                            stacks: [],
                        }
                        parent === null || parent === void 0 ? void 0 : parent.stacks.push(commandStack)
                        return [
                            5 /*yield**/,
                            tslib_1.__values(
                                koka_1.Eff.try(
                                    target.call.apply(
                                        target,
                                        tslib_1.__spreadArray([this], tslib_1.__read(args), false),
                                    ),
                                ).catch({
                                    commandStack: commandStack,
                                }),
                            ),
                        ]
                    case 2:
                        result = _c.sent()
                        commandStack.return = result
                        return [2 /*return*/, result]
                }
            })
        }
        return replacementMethod
    }
}
var Store = /** @class */ (function () {
    function Store(options) {
        var _this = this
        this.context = {}
        this.getState = function () {
            return _this.state
        }
        this.dirty = false
        this.setState = function (state) {
            if (state === _this.state) {
                return
            }
            _this.state = state
            _this.dirty = true
            // Schedule a microtask to publish the state change
            var currentPid = _this.pid++
            Promise.resolve().then(function () {
                if (currentPid === _this.pid) {
                    _this.publish()
                }
            })
        }
        this.pid = 0
        this.listeners = []
        this.state = options.state
    }
    Store.prototype.subscribe = function (listener) {
        var _this = this
        this.listeners.push(listener)
        return function () {
            var index = _this.listeners.indexOf(listener)
            if (index !== -1) {
                _this.listeners.splice(index, 1)
            }
        }
    }
    Store.prototype.publish = function () {
        var e_3, _a
        if (!this.dirty) {
            return
        }
        // Reset dirty flag
        this.dirty = false
        try {
            for (var _b = tslib_1.__values(this.listeners), _c = _b.next(); !_c.done; _c = _b.next()) {
                var listener = _c.value
                listener(this.state)
            }
        } catch (e_3_1) {
            e_3 = { error: e_3_1 }
        } finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b)
            } finally {
                if (e_3) throw e_3.error
            }
        }
    }
    Store.prototype.get = function (domainOrOptic) {
        var result = this.runQuery(get(domainOrOptic))
        return result
    }
    Store.prototype.set = function (domainOrOptic, input) {
        var result = this.runCommand(set(domainOrOptic, input))
        return result
    }
    Store.prototype.runQuery = function (input) {
        var query = typeof input === 'function' ? input() : input
        var withRoot = koka_1.Eff.try(query).catch(tslib_1.__assign({ getRoot: this.getState }, this.context))
        return koka_1.Eff.runResult(withRoot)
    }
    Store.prototype.runCommand = function (input) {
        var command = typeof input === 'function' ? input() : input
        var commandStack = {
            name: '',
            async: false,
            args: [],
            return: undefined,
            states: [],
            stacks: [],
        }
        var withRoot = koka_1.Eff.try(command).catch(
            tslib_1.__assign(tslib_1.__assign({ setRoot: this.setState, getRoot: this.getState }, this.context), {
                commandStack: commandStack,
            }),
        )
        try {
            var result = koka_1.Eff.runResult(withRoot)
            var handleResult = function (result) {
                commandStack.return = result
                console.log((0, exports.prettyPrintCommandStack)(commandStack))
                return result
            }
            if (result instanceof Promise) {
                return result.then(handleResult)
            }
            return handleResult(result)
        } finally {
            this.publish()
        }
    }
    return Store
})()
exports.Store = Store
//# sourceMappingURL=koka-ddd.js.map
