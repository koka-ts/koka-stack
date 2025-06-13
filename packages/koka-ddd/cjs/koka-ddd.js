'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.Store = exports.Domain = void 0
exports.get = get
exports.set = set
var tslib_1 = require('tslib')
var koka_1 = require('koka')
var koka_optic_1 = require('koka-optic')
tslib_1.__exportStar(require('koka-optic'), exports)
var Domain = /** @class */ (function () {
    function Domain(options) {
        this.$ = new koka_optic_1.Optic(options)
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
    var optic, updateRoot, getRoot, root, newRoot, setRoot
    return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                optic = domainOrOptic instanceof Domain ? domainOrOptic.$ : domainOrOptic
                updateRoot = optic.set(function (State) {
                    var result, value
                    return tslib_1.__generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (typeof setStateInput !== 'function') {
                                    return [2 /*return*/, setStateInput]
                                }
                                result = setStateInput(State)
                                return [5 /*yield**/, tslib_1.__values((0, koka_optic_1.getOpticValue)(result))]
                            case 1:
                                value = _a.sent()
                                return [2 /*return*/, value]
                        }
                    })
                })
                return [5 /*yield**/, tslib_1.__values(koka_1.Eff.ctx('getRoot').get())]
            case 1:
                getRoot = _a.sent()
                root = getRoot()
                return [5 /*yield**/, tslib_1.__values(updateRoot(root))]
            case 2:
                newRoot = _a.sent()
                return [5 /*yield**/, tslib_1.__values(koka_1.Eff.ctx('setRoot').get())]
            case 3:
                setRoot = _a.sent()
                setRoot(newRoot)
                return [2 /*return*/]
        }
    })
}
var Store = /** @class */ (function () {
    function Store(options) {
        var _this = this
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
        var withRoot = koka_1.Eff.try(query).catch({
            getRoot: this.getState,
        })
        return koka_1.Eff.runResult(withRoot)
    }
    Store.prototype.runCommand = function (input) {
        var command = typeof input === 'function' ? input() : input
        var withRoot = koka_1.Eff.try(command).catch({
            setRoot: this.setState,
            getRoot: this.getState,
        })
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
