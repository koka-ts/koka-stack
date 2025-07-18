'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.Store = exports.ExecutionTreeOpt = exports.SetRoot = exports.GetRoot = exports.Domain = void 0
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
var GetRoot = /** @class */ (function (_super) {
    tslib_1.__extends(GetRoot, _super)
    function GetRoot() {
        return (_super !== null && _super.apply(this, arguments)) || this
    }
    return GetRoot
})(koka_1.Eff.Ctx('koka-ddd/get-root'))
exports.GetRoot = GetRoot
var SetRoot = /** @class */ (function (_super) {
    tslib_1.__extends(SetRoot, _super)
    function SetRoot() {
        return (_super !== null && _super.apply(this, arguments)) || this
    }
    return SetRoot
})(koka_1.Eff.Ctx('koka-ddd/set-root'))
exports.SetRoot = SetRoot
var ExecutionTreeOpt = /** @class */ (function (_super) {
    tslib_1.__extends(ExecutionTreeOpt, _super)
    function ExecutionTreeOpt() {
        return (_super !== null && _super.apply(this, arguments)) || this
    }
    return ExecutionTreeOpt
})(koka_1.Eff.Opt('koka-ddd/execution-tree'))
exports.ExecutionTreeOpt = ExecutionTreeOpt
function get(domainOrOptic) {
    var optic, executionTree, getRoot, root, state
    return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                optic = domainOrOptic instanceof Domain ? domainOrOptic.$ : domainOrOptic
                return [5 /*yield**/, tslib_1.__values(koka_1.Eff.get(ExecutionTreeOpt))]
            case 1:
                executionTree = _a.sent()
                return [5 /*yield**/, tslib_1.__values(koka_1.Eff.get(GetRoot))]
            case 2:
                getRoot = _a.sent()
                root = getRoot()
                return [5 /*yield**/, tslib_1.__values(optic.get(root))]
            case 3:
                state = _a.sent()
                executionTree === null || executionTree === void 0 ? void 0 : executionTree.states.push(state)
                return [2 /*return*/, state]
        }
    })
}
function set(domainOrOptic, setStateInput) {
    var optic, executionTree, updateRoot, getRoot, root, newRoot, setRoot
    return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                optic = domainOrOptic instanceof Domain ? domainOrOptic.$ : domainOrOptic
                return [5 /*yield**/, tslib_1.__values(koka_1.Eff.get(ExecutionTreeOpt))]
            case 1:
                executionTree = _a.sent()
                updateRoot = optic.set(function (state) {
                    var result, nextState
                    return tslib_1.__generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (typeof setStateInput !== 'function') {
                                    if (
                                        (executionTree === null || executionTree === void 0
                                            ? void 0
                                            : executionTree.type) === 'command'
                                    ) {
                                        executionTree.changes.push({
                                            previous: state,
                                            next: setStateInput,
                                        })
                                    }
                                    return [2 /*return*/, setStateInput]
                                }
                                result = setStateInput(state)
                                return [5 /*yield**/, tslib_1.__values((0, koka_optic_1.getOpticValue)(result))]
                            case 1:
                                nextState = _a.sent()
                                if (
                                    (executionTree === null || executionTree === void 0
                                        ? void 0
                                        : executionTree.type) === 'command'
                                ) {
                                    executionTree.changes.push({
                                        previous: state,
                                        next: nextState,
                                    })
                                }
                                return [2 /*return*/, nextState]
                        }
                    })
                })
                return [5 /*yield**/, tslib_1.__values(koka_1.Eff.get(GetRoot))]
            case 2:
                getRoot = _a.sent()
                root = getRoot()
                return [5 /*yield**/, tslib_1.__values(updateRoot(root))]
            case 3:
                newRoot = _a.sent()
                return [5 /*yield**/, tslib_1.__values(koka_1.Eff.get(SetRoot))]
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
            var _i, parent, name, executionTree, gen, result, effect, _a, _b, _c, _d
            var _e
            var _f, _g
            var args = []
            for (_i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i]
            }
            return tslib_1.__generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        return [5 /*yield**/, tslib_1.__values(koka_1.Eff.get(ExecutionTreeOpt))]
                    case 1:
                        parent = _h.sent()
                        name = ''
                            .concat(
                                (_g = (_f = this.constructor) === null || _f === void 0 ? void 0 : _f.name) !== null &&
                                    _g !== void 0
                                    ? _g
                                    : 'UnknownDomain',
                                '.',
                            )
                            .concat(methodName)
                        executionTree = {
                            type: 'query',
                            async: false,
                            name: name,
                            args: args,
                            return: undefined,
                            states: [],
                            queries: [],
                        }
                        if (parent) {
                            parent.queries.push(executionTree)
                        }
                        gen = koka_1.Eff.try(
                            target.call.apply(target, tslib_1.__spreadArray([this], tslib_1.__read(args), false)),
                        ).catch(((_e = {}), (_e[ExecutionTreeOpt.field] = executionTree), _e))
                        result = gen.next()
                        _h.label = 2
                    case 2:
                        if (!!result.done) return [3 /*break*/, 7]
                        effect = result.value
                        if (!(effect.type === 'async')) return [3 /*break*/, 4]
                        executionTree.async = true
                        _b = (_a = gen).next
                        return [4 /*yield*/, effect]
                    case 3:
                        result = _b.apply(_a, [_h.sent()])
                        return [3 /*break*/, 6]
                    case 4:
                        _d = (_c = gen).next
                        return [4 /*yield*/, effect]
                    case 5:
                        result = _d.apply(_c, [_h.sent()])
                        _h.label = 6
                    case 6:
                        return [3 /*break*/, 2]
                    case 7:
                        executionTree.return = result.value
                        return [2 /*return*/, result.value]
                }
            })
        }
        return replacementMethod
    }
}
function command() {
    return function (target, context) {
        var methodName = context.name
        function replacementMethod() {
            var _i, parent, name, executionTree, gen, result, effect, _a, _b, _c, _d
            var _e
            var _f, _g
            var args = []
            for (_i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i]
            }
            return tslib_1.__generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        return [5 /*yield**/, tslib_1.__values(koka_1.Eff.get(ExecutionTreeOpt))]
                    case 1:
                        parent = _h.sent()
                        name = ''
                            .concat(
                                (_g = (_f = this.constructor) === null || _f === void 0 ? void 0 : _f.name) !== null &&
                                    _g !== void 0
                                    ? _g
                                    : 'UnknownDomain',
                                '.',
                            )
                            .concat(methodName)
                        executionTree = {
                            type: 'command',
                            async: false,
                            name: name,
                            args: args,
                            return: undefined,
                            states: [],
                            changes: [],
                            commands: [],
                            queries: [],
                        }
                        if ((parent === null || parent === void 0 ? void 0 : parent.type) === 'command') {
                            parent.commands.push(executionTree)
                        }
                        gen = koka_1.Eff.try(
                            target.call.apply(target, tslib_1.__spreadArray([this], tslib_1.__read(args), false)),
                        ).catch(((_e = {}), (_e[ExecutionTreeOpt.field] = executionTree), _e))
                        result = gen.next()
                        _h.label = 2
                    case 2:
                        if (!!result.done) return [3 /*break*/, 7]
                        effect = result.value
                        if (!(effect.type === 'async')) return [3 /*break*/, 4]
                        executionTree.async = true
                        _b = (_a = gen).next
                        return [4 /*yield*/, effect]
                    case 3:
                        result = _b.apply(_a, [_h.sent()])
                        return [3 /*break*/, 6]
                    case 4:
                        _d = (_c = gen).next
                        return [4 /*yield*/, effect]
                    case 5:
                        result = _d.apply(_c, [_h.sent()])
                        _h.label = 6
                    case 6:
                        return [3 /*break*/, 2]
                    case 7:
                        executionTree.return = result.value
                        return [2 /*return*/, result.value]
                }
            })
        }
        return replacementMethod
    }
}
var Store = /** @class */ (function () {
    function Store(options) {
        var e_1, _a
        var _this = this
        var _b
        this.context = {}
        this.enhancers = []
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
        this.executionListeners = []
        this.state = options.state
        this.enhancers = tslib_1.__spreadArray(
            tslib_1.__spreadArray([], tslib_1.__read(this.enhancers), false),
            tslib_1.__read((_b = options.enhancers) !== null && _b !== void 0 ? _b : []),
            false,
        )
        try {
            for (var _c = tslib_1.__values(this.enhancers), _d = _c.next(); !_d.done; _d = _c.next()) {
                var enhancer = _d.value
                enhancer(this)
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
        var e_2, _a
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
        } catch (e_2_1) {
            e_2 = { error: e_2_1 }
        } finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b)
            } finally {
                if (e_2) throw e_2.error
            }
        }
    }
    Store.prototype.subscribeExecution = function (listener) {
        var _this = this
        this.executionListeners.push(listener)
        return function () {
            var index = _this.executionListeners.indexOf(listener)
            if (index !== -1) {
                _this.executionListeners.splice(index, 1)
            }
        }
    }
    Store.prototype.publishExecution = function (tree) {
        var e_3, _a
        try {
            for (var _b = tslib_1.__values(this.executionListeners), _c = _b.next(); !_c.done; _c = _b.next()) {
                var listener = _c.value
                listener(tree)
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
        var _a
        var _this = this
        var query = typeof input === 'function' ? input() : input
        var executionTree =
            this.enhancers.length > 0
                ? {
                      type: 'query',
                      async: true,
                      name: '',
                      args: [],
                      return: undefined,
                      states: [],
                      queries: [],
                  }
                : undefined
        var withRoot = koka_1.Eff.try(query).catch(
            tslib_1.__assign(
                tslib_1.__assign({}, this.context),
                ((_a = {}), (_a[GetRoot.field] = this.getState), (_a[ExecutionTreeOpt.field] = executionTree), _a),
            ),
        )
        var result = koka_1.Eff.runResult(withRoot)
        var handleResult = function (result) {
            if (executionTree) {
                executionTree.return = result
                _this.publishExecution(executionTree)
            }
            return result
        }
        if (result instanceof Promise) {
            return result.then(handleResult)
        }
        return handleResult(result)
    }
    Store.prototype.runCommand = function (input) {
        var _a
        var _this = this
        var command = typeof input === 'function' ? input() : input
        var executionTree =
            this.enhancers.length > 0
                ? {
                      type: 'command',
                      async: true,
                      name: '#root#',
                      args: [],
                      return: undefined,
                      states: [],
                      changes: [],
                      commands: [],
                      queries: [],
                  }
                : undefined
        var withRoot = koka_1.Eff.try(command).catch(
            tslib_1.__assign(
                tslib_1.__assign({}, this.context),
                ((_a = {}),
                (_a[SetRoot.field] = this.setState),
                (_a[GetRoot.field] = this.getState),
                (_a[ExecutionTreeOpt.field] = executionTree),
                _a),
            ),
        )
        try {
            var result = koka_1.Eff.runResult(withRoot)
            var handleResult = function (result) {
                if (executionTree) {
                    executionTree.return = result
                    _this.publishExecution(executionTree)
                }
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
