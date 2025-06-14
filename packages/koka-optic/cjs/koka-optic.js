'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.Optic = void 0
exports.getOpticValue = getOpticValue
var tslib_1 = require('tslib')
var koka_1 = require('koka')
function getOpticValue(value) {
    return tslib_1.__generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!(0, koka_1.isGenerator)(value)) return [3 /*break*/, 2]
                return [5 /*yield**/, tslib_1.__values(value)]
            case 1:
                return [2 /*return*/, _a.sent()]
            case 2:
                return [2 /*return*/, value]
        }
    })
}
var opticWeakMap = new WeakMap()
var setOpticCache = function (object, optic, value) {
    var opticMap = opticWeakMap.get(object)
    if (!opticMap) {
        opticMap = new WeakMap()
        opticWeakMap.set(object, opticMap)
    }
    opticMap.set(optic, value)
}
var Optic = /** @class */ (function () {
    function Optic(options) {
        this.get = options.get
        this.set = options.set
    }
    Optic.root = function () {
        return new Optic({
            get: function (root) {
                return tslib_1.__generator(this, function (_a) {
                    return [2 /*return*/, root]
                })
            },
            set: function (updater) {
                return function (root) {
                    var newRoot
                    return tslib_1.__generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                return [5 /*yield**/, tslib_1.__values(updater(root))]
                            case 1:
                                newRoot = _a.sent()
                                return [2 /*return*/, newRoot]
                        }
                    })
                }
            },
        })
    }
    Optic.object = function (optics) {
        return this.root()
            .select({
                get: function (root) {
                    var object, _a, _b, _c, _i, key, _d, _e
                    return tslib_1.__generator(this, function (_f) {
                        switch (_f.label) {
                            case 0:
                                object = {}
                                _a = optics
                                _b = []
                                for (_c in _a) _b.push(_c)
                                _i = 0
                                _f.label = 1
                            case 1:
                                if (!(_i < _b.length)) return [3 /*break*/, 4]
                                _c = _b[_i]
                                if (!(_c in _a)) return [3 /*break*/, 3]
                                key = _c
                                // @ts-ignore
                                _d = object
                                _e = key
                                return [5 /*yield**/, tslib_1.__values(optics[key].get(root))]
                            case 2:
                                // @ts-ignore
                                _d[_e] = _f.sent()
                                _f.label = 3
                            case 3:
                                _i++
                                return [3 /*break*/, 1]
                            case 4:
                                return [
                                    2 /*return*/,
                                    {
                                        oldObject: object,
                                        newObject: object,
                                    },
                                ]
                        }
                    })
                },
                set: function (state, root) {
                    var _loop_1, _a, _b, _c, _i, key
                    return tslib_1.__generator(this, function (_d) {
                        switch (_d.label) {
                            case 0:
                                _loop_1 = function (key) {
                                    var newValue, oldValue
                                    return tslib_1.__generator(this, function (_e) {
                                        switch (_e.label) {
                                            case 0:
                                                newValue = state.newObject[key]
                                                oldValue = state.oldObject[key]
                                                if (newValue === oldValue) {
                                                    return [2 /*return*/, 'continue']
                                                }
                                                return [
                                                    5 /*yield**/,
                                                    tslib_1.__values(
                                                        optics[key].set(function () {
                                                            return tslib_1.__generator(this, function (_a) {
                                                                return [2 /*return*/, newValue]
                                                            })
                                                        })(root),
                                                    ),
                                                ]
                                            case 1:
                                                // @ts-ignore expected
                                                root = _e.sent()
                                                return [2 /*return*/]
                                        }
                                    })
                                }
                                _a = state.newObject
                                _b = []
                                for (_c in _a) _b.push(_c)
                                _i = 0
                                _d.label = 1
                            case 1:
                                if (!(_i < _b.length)) return [3 /*break*/, 4]
                                _c = _b[_i]
                                if (!(_c in _a)) return [3 /*break*/, 3]
                                key = _c
                                return [5 /*yield**/, _loop_1(key)]
                            case 2:
                                _d.sent()
                                _d.label = 3
                            case 3:
                                _i++
                                return [3 /*break*/, 1]
                            case 4:
                                return [2 /*return*/, root]
                        }
                    })
                },
            })
            .prop('newObject')
    }
    Optic.optional = function (optic) {
        return Optic.root().select({
            get: function (root) {
                var result
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            return [5 /*yield**/, tslib_1.__values(koka_1.Eff.result(optic.get(root)))]
                        case 1:
                            result = _a.sent()
                            if (result.type === 'ok') {
                                return [2 /*return*/, result.value]
                            }
                            return [2 /*return*/]
                    }
                })
            },
            set: function (state, root) {
                var newState, newRoot
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (state === undefined) {
                                return [2 /*return*/, root]
                            }
                            newState = state
                            return [
                                5 /*yield**/,
                                tslib_1.__values(
                                    optic.set(function () {
                                        return tslib_1.__generator(this, function (_a) {
                                            return [2 /*return*/, newState]
                                        })
                                    })(root),
                                ),
                            ]
                        case 1:
                            newRoot = _a.sent()
                            return [2 /*return*/, newRoot]
                    }
                })
            },
        })
    }
    Optic.get = function (root, optic) {
        return optic.get(root)
    }
    Optic.set = function (root, optic, stateOrUpdater) {
        if (typeof stateOrUpdater === 'function') {
            var updater_1 = stateOrUpdater
            return optic.set(function (state) {
                var newState
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            newState = updater_1(state)
                            if (!(0, koka_1.isGenerator)(newState)) return [3 /*break*/, 2]
                            return [5 /*yield**/, tslib_1.__values(newState)]
                        case 1:
                            return [2 /*return*/, _a.sent()]
                        case 2:
                            return [2 /*return*/, newState]
                    }
                })
            })(root)
        } else {
            var state_1 = stateOrUpdater
            return optic.set(function () {
                return tslib_1.__generator(this, function (_a) {
                    return [2 /*return*/, state_1]
                })
            })(root)
        }
    }
    Optic.prototype.toJSON = function () {
        return undefined
    }
    Optic.prototype.select = function (selector) {
        var _a = this,
            get = _a.get,
            set = _a.set
        var optic = new Optic({
            get: function (root) {
                var isObjectRoot, opticMap, state, isObjectState, target_1, target
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            isObjectRoot = typeof root === 'object' && root !== null
                            opticMap = isObjectRoot ? opticWeakMap.get(root) : null
                            if (opticMap === null || opticMap === void 0 ? void 0 : opticMap.has(optic)) {
                                return [2 /*return*/, opticMap.get(optic)]
                            }
                            return [5 /*yield**/, tslib_1.__values(get(root))]
                        case 1:
                            state = _a.sent()
                            isObjectState = typeof state === 'object' && state !== null
                            opticMap = isObjectState ? opticWeakMap.get(state) : null
                            if (opticMap === null || opticMap === void 0 ? void 0 : opticMap.has(optic)) {
                                target_1 = opticMap.get(optic)
                                if (isObjectRoot) {
                                    setOpticCache(root, optic, target_1)
                                }
                                return [2 /*return*/, target_1]
                            }
                            return [5 /*yield**/, tslib_1.__values(getOpticValue(selector.get(state)))]
                        case 2:
                            target = _a.sent()
                            if (isObjectState) {
                                setOpticCache(state, optic, target)
                            }
                            if (isObjectRoot) {
                                setOpticCache(root, optic, target)
                            }
                            return [2 /*return*/, target]
                    }
                })
            },
            set: function (updater) {
                var updateState = function (state) {
                    var target, isObjectState, opticMap, newTarget, newState, isObjectNewState
                    return tslib_1.__generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                isObjectState = typeof state === 'object' && state !== null
                                opticMap = isObjectState ? opticWeakMap.get(state) : null
                                if (!(opticMap === null || opticMap === void 0 ? void 0 : opticMap.has(optic)))
                                    return [3 /*break*/, 1]
                                target = opticMap.get(optic)
                                return [3 /*break*/, 3]
                            case 1:
                                return [5 /*yield**/, tslib_1.__values(getOpticValue(selector.get(state)))]
                            case 2:
                                target = _a.sent()
                                if (isObjectState) {
                                    setOpticCache(state, optic, target)
                                }
                                _a.label = 3
                            case 3:
                                return [5 /*yield**/, tslib_1.__values(updater(target))]
                            case 4:
                                newTarget = _a.sent()
                                return [5 /*yield**/, tslib_1.__values(getOpticValue(selector.set(newTarget, state)))]
                            case 5:
                                newState = _a.sent()
                                isObjectNewState = typeof newState === 'object' && newState !== null
                                if (isObjectNewState) {
                                    setOpticCache(newState, optic, newTarget)
                                }
                                return [2 /*return*/, newState]
                        }
                    })
                }
                var updateRoot = set(updateState)
                return updateRoot
            },
        })
        return optic
    }
    Optic.prototype.prop = function (key) {
        return this.select({
            get: function (state) {
                return state[key]
            },
            set: function (newValue, state) {
                var _a
                return tslib_1.__assign(tslib_1.__assign({}, state), ((_a = {}), (_a[key] = newValue), _a))
            },
        })
    }
    Optic.prototype.index = function (index) {
        return this.select({
            get: function (state) {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!Array.isArray(state)) return [3 /*break*/, 2]
                            return [
                                5 /*yield**/,
                                tslib_1.__values(
                                    koka_1.Eff.err('OpticErr').throw(
                                        '[koka-optic] Index '.concat(index, ' is not applied for an array'),
                                    ),
                                ),
                            ]
                        case 1:
                            throw _a.sent()
                        case 2:
                            if (!(index < 0 || index >= state.length)) return [3 /*break*/, 4]
                            return [
                                5 /*yield**/,
                                tslib_1.__values(
                                    koka_1.Eff.err('OpticErr').throw(
                                        '[koka-optic] Index '.concat(index, ' is out of bounds: ').concat(state.length),
                                    ),
                                ),
                            ]
                        case 3:
                            throw _a.sent()
                        case 4:
                            return [2 /*return*/, state[index]]
                    }
                })
            },
            set: function (newValue, state) {
                var newState
                return tslib_1.__generator(this, function (_a) {
                    newState = tslib_1.__spreadArray([], tslib_1.__read(state), false)
                    newState[index] = newValue
                    return [2 /*return*/, newState]
                })
            },
        })
    }
    Optic.prototype.find = function (predicate) {
        return this.select({
            get: function (list) {
                var index, target
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!Array.isArray(list)) return [3 /*break*/, 2]
                            return [
                                5 /*yield**/,
                                tslib_1.__values(
                                    koka_1.Eff.err('OpticErr').throw(
                                        '[koka-optic] Find '.concat(predicate, ' is not applied for an array'),
                                    ),
                                ),
                            ]
                        case 1:
                            throw _a.sent()
                        case 2:
                            index = list.findIndex(predicate)
                            if (!(index === -1)) return [3 /*break*/, 4]
                            return [
                                5 /*yield**/,
                                tslib_1.__values(koka_1.Eff.err('OpticErr').throw('[koka-optic] Item not found')),
                            ]
                        case 3:
                            throw _a.sent()
                        case 4:
                            target = list[index]
                            return [
                                2 /*return*/,
                                {
                                    target: target,
                                    index: index,
                                },
                            ]
                    }
                })
            },
            set: function (itemInfo, list) {
                var newList = tslib_1.__spreadArray([], tslib_1.__read(list), false)
                newList[itemInfo.index] = itemInfo.target
                return newList
            },
        }).prop('target')
    }
    Optic.prototype.match = function (predicate) {
        return this.select({
            get: function (state) {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!predicate(state)) return [3 /*break*/, 2]
                            return [
                                5 /*yield**/,
                                tslib_1.__values(
                                    koka_1.Eff.err('OpticErr').throw(
                                        '[koka-optic] State does not match by '.concat(predicate),
                                    ),
                                ),
                            ]
                        case 1:
                            throw _a.sent()
                        case 2:
                            return [2 /*return*/, state]
                    }
                })
            },
            set: function (newState) {
                return newState
            },
        })
    }
    Optic.prototype.refine = function (predicate) {
        return this.select({
            get: function (state) {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!predicate(state)) return [3 /*break*/, 2]
                            return [
                                5 /*yield**/,
                                tslib_1.__values(
                                    koka_1.Eff.err('OpticErr').throw(
                                        '[koka-optic] State does not match by '.concat(predicate),
                                    ),
                                ),
                            ]
                        case 1:
                            throw _a.sent()
                        case 2:
                            return [2 /*return*/, state]
                    }
                })
            },
            set: function (newState) {
                return newState
            },
        })
    }
    Optic.prototype.as = function () {
        return this
    }
    Optic.prototype.map = function (mapper) {
        var from = Optic.root()
        var mapper$
        if (typeof mapper === 'function') {
            mapper$ = mapper(from)
        } else if (mapper instanceof Optic) {
            mapper$ = mapper
        } else {
            mapper$ = from.select(mapper)
        }
        return this.select({
            get: function (state) {
                var list, targetList, _a, _b, item, target, e_1_1
                var e_1, _c
                return tslib_1.__generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            list = state
                            targetList = []
                            _d.label = 1
                        case 1:
                            _d.trys.push([1, 6, 7, 8])
                            ;(_a = tslib_1.__values(list)), (_b = _a.next())
                            _d.label = 2
                        case 2:
                            if (!!_b.done) return [3 /*break*/, 5]
                            item = _b.value
                            return [5 /*yield**/, tslib_1.__values(mapper$.get(item))]
                        case 3:
                            target = _d.sent()
                            targetList.push(target)
                            _d.label = 4
                        case 4:
                            _b = _a.next()
                            return [3 /*break*/, 2]
                        case 5:
                            return [3 /*break*/, 8]
                        case 6:
                            e_1_1 = _d.sent()
                            e_1 = { error: e_1_1 }
                            return [3 /*break*/, 8]
                        case 7:
                            try {
                                if (_b && !_b.done && (_c = _a.return)) _c.call(_a)
                            } finally {
                                if (e_1) throw e_1.error
                            }
                            return [7 /*endfinally*/]
                        case 8:
                            return [2 /*return*/, targetList]
                    }
                })
            },
            set: function (targetList, state) {
                var list, newList, _loop_2, i
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            list = state
                            newList = []
                            if (!(list.length !== targetList.length)) return [3 /*break*/, 2]
                            return [
                                5 /*yield**/,
                                tslib_1.__values(
                                    koka_1.Eff.err('OpticErr').throw(
                                        '[koka-optic] List length mismatch: '
                                            .concat(list.length, ' !== ')
                                            .concat(targetList.length),
                                    ),
                                ),
                            ]
                        case 1:
                            throw _a.sent()
                        case 2:
                            _loop_2 = function (i) {
                                var item, newTarget, updateItem, newItem
                                return tslib_1.__generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            item = list[i]
                                            newTarget = targetList[i]
                                            updateItem = mapper$.set(function () {
                                                return tslib_1.__generator(this, function (_a) {
                                                    return [2 /*return*/, newTarget]
                                                })
                                            })
                                            return [5 /*yield**/, tslib_1.__values(updateItem(item))]
                                        case 1:
                                            newItem = _b.sent()
                                            newList.push(newItem)
                                            return [2 /*return*/]
                                    }
                                })
                            }
                            i = 0
                            _a.label = 3
                        case 3:
                            if (!(i < list.length)) return [3 /*break*/, 6]
                            return [5 /*yield**/, _loop_2(i)]
                        case 4:
                            _a.sent()
                            _a.label = 5
                        case 5:
                            i++
                            return [3 /*break*/, 3]
                        case 6:
                            return [2 /*return*/, newList]
                    }
                })
            },
        })
    }
    Optic.prototype.filter = function (predicate) {
        var getKey = this.getKey
        return this.select({
            get: function (list) {
                var indexRecord, indexList, filtered
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!Array.isArray(list)) return [3 /*break*/, 2]
                            return [
                                5 /*yield**/,
                                tslib_1.__values(
                                    koka_1.Eff.err('OpticErr').throw(
                                        '[koka-optic] Filter '.concat(predicate, ' is not applied for an array'),
                                    ),
                                ),
                            ]
                        case 1:
                            throw _a.sent()
                        case 2:
                            filtered = list.filter(function (item, index) {
                                if (!predicate(item, index)) return false
                                if (getKey) {
                                    var key = getKey(item)
                                    if (indexRecord === undefined) {
                                        indexRecord = {}
                                    }
                                    if (key in indexRecord) {
                                        throw new Error('[koka-optic] Key '.concat(key, ' is not unique'))
                                    }
                                    indexRecord[key] = index
                                } else {
                                    if (indexList === undefined) {
                                        indexList = []
                                    }
                                    indexList.push(index)
                                }
                                return true
                            })
                            return [
                                2 /*return*/,
                                {
                                    filtered: filtered,
                                    indexRecord: indexRecord,
                                    indexList: indexList,
                                },
                            ]
                    }
                })
            },
            set: function (filteredInfo, list) {
                var newList,
                    filtered,
                    indexRecord,
                    indexList,
                    filtered_1,
                    filtered_1_1,
                    newItem,
                    key,
                    index,
                    i,
                    index,
                    newItem
                var e_2, _a
                return tslib_1.__generator(this, function (_b) {
                    newList = tslib_1.__spreadArray([], tslib_1.__read(list), false)
                    ;(filtered = filteredInfo.filtered),
                        (indexRecord = filteredInfo.indexRecord),
                        (indexList = filteredInfo.indexList)
                    if (indexRecord) {
                        try {
                            for (
                                filtered_1 = tslib_1.__values(filtered), filtered_1_1 = filtered_1.next();
                                !filtered_1_1.done;
                                filtered_1_1 = filtered_1.next()
                            ) {
                                newItem = filtered_1_1.value
                                key = getKey(newItem)
                                if (!(key in indexRecord)) {
                                    continue
                                }
                                index = indexRecord[key]
                                newList[index] = newItem
                            }
                        } catch (e_2_1) {
                            e_2 = { error: e_2_1 }
                        } finally {
                            try {
                                if (filtered_1_1 && !filtered_1_1.done && (_a = filtered_1.return)) _a.call(filtered_1)
                            } finally {
                                if (e_2) throw e_2.error
                            }
                        }
                    } else if (indexList) {
                        for (i = 0; i < indexList.length; i++) {
                            if (i >= filtered.length) {
                                break
                            }
                            index = indexList[i]
                            newItem = filtered[i]
                            newList[index] = newItem
                        }
                    }
                    return [2 /*return*/, newList]
                })
            },
        }).prop('filtered')
    }
    return Optic
})()
exports.Optic = Optic
//# sourceMappingURL=koka-optic.js.map
