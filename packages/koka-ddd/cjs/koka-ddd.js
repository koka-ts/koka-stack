'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.Store = exports.Domain = void 0
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
                                    commandStack.states.push({
                                        previous: state,
                                        next: setStateInput,
                                    })
                                    return [2 /*return*/, setStateInput]
                                }
                                result = setStateInput(state)
                                return [5 /*yield**/, tslib_1.__values((0, koka_optic_1.getOpticValue)(result))]
                            case 1:
                                nextState = _a.sent()
                                commandStack.states.push({
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
            var _i, commandStack, result
            var args = []
            for (_i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i]
            }
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        commandStack = {
                            // parent: parent,
                            name: methodName,
                            args: [],
                            return: undefined,
                            states: [],
                            stacks: [],
                        }
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
                    case 1:
                        result = _a.sent()
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
        var e_1, _a
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
        } catch (e_1_1) {
            e_1 = { error: e_1_1 }
        } finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b)
            } finally {
                if (e_1) throw e_1.error
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
        var withRoot = koka_1.Eff.try(command).catch(
            tslib_1.__assign({ setRoot: this.setState, getRoot: this.getState }, this.context),
        )
        try {
            return koka_1.Eff.runResult(withRoot)
        } finally {
            this.publish()
        }
    }
    return Store
})()
exports.Store = Store
//# sourceMappingURL=koka-ddd.js.map
