import { Optic, OpticProxy } from '../src/koka-optic'
import { Eff } from 'koka'

describe('Optic', () => {
    describe('root()', () => {
        it('should create root optic', () => {
            const rootOptic = Optic.root<number>()
            expect(rootOptic).toBeInstanceOf(Optic)
        })

        it('should get root value', () => {
            const rootOptic = Optic.root<number>()
            const result = Eff.runResult(Optic.get(42, rootOptic))

            if (result.type === 'err') {
                throw new Error('Expected a number but got an error')
            }

            expect(result.value).toBe(42)
        })

        it('should set root value', () => {
            const rootOptic = Optic.root<number>()
            const updateRoot = Optic.set(42, rootOptic, (number) => number + 58)
            const result = Eff.runResult(updateRoot)

            if (result.type === 'err') {
                throw new Error('Expected a number but got an error')
            }

            expect(result.value).toBe(100)
        })
    })

    describe('prop()', () => {
        const propOptic = Optic.root<{ a: number }>().prop('a')

        it('should get object property', () => {
            const result = Eff.runResult(Optic.get({ a: 42 }, propOptic))

            if (result.type === 'err') {
                throw new Error('Expected a number but got an error')
            }

            expect(result.value).toBe(42)
        })

        it('should set object property', () => {
            const result = Eff.runResult(Optic.set({ a: 42 }, propOptic, 100))

            if (result.type === 'err') {
                throw new Error('Expected an object but got an error')
            }

            expect(result.value).toEqual({ a: 100 })
        })
    })

    describe('index()', () => {
        const indexOptic = Optic.root<number[]>().index(0)

        it('should get array index', () => {
            const result = Eff.runResult(Optic.get([42], indexOptic))

            if (result.type === 'err') {
                throw new Error('Expected a number but got an error')
            }

            expect(result.value).toBe(42)
        })

        it('should set array index', () => {
            const result = Eff.runResult(Optic.set([42], indexOptic, 100))

            if (result.type === 'err') {
                throw new Error('Expected an array but got an error')
            }

            expect(result.value).toEqual([100])
        })

        it('should throw when index out of bounds', () => {
            const result = Eff.runResult(Optic.get([], indexOptic))

            if (result.type === 'ok') {
                throw new Error('Expected an error but got a number')
            }

            expect(result.type).toBe('err')
        })
    })

    describe('find()', () => {
        const findOptic = Optic.root<number[]>().find((n) => n === 42)

        it('should find array item', () => {
            const result = Eff.runResult(Optic.get([1, 2, 3, 42], findOptic))

            if (result.type === 'err') {
                throw new Error('Expected a number but got an error')
            }

            expect(result.value).toBe(42)
        })

        it('should throw when item not found', () => {
            const result = Eff.runResult(Optic.get([1, 2, 3], findOptic))

            if (result.type === 'ok') {
                throw new Error('Expected an error but got a number')
            }

            expect(result.type).toBe('err')
        })
    })

    describe('match()', () => {
        const matchOptic = Optic.root<string | number>().match((v): v is number => typeof v === 'number')

        it('should match type predicate', () => {
            const result = Eff.runResult(Optic.get(42, matchOptic))

            if (result.type === 'err') {
                throw new Error('Expected a number but got an error')
            }

            expect(result.value).toBe(42)
        })

        it('should throw when not matched', () => {
            const result = Eff.runResult(Optic.get('test', matchOptic))

            if (result.type === 'ok') {
                throw new Error('Expected an error but got a string')
            }

            expect(result.type).toBe('err')
        })
    })

    describe('map()', () => {
        const mapOptic = Optic.root<number[]>().map({
            get: (n) => n * 2,
            set: (newN: number) => newN / 2,
        })

        it('should map array items', () => {
            const result = Eff.runResult(Optic.get([1, 2, 3], mapOptic))

            if (result.type === 'err') {
                throw new Error('Expected a number but got an error')
            }

            expect(result.value).toEqual([2, 4, 6])
        })

        it('should set mapped array', () => {
            const result = Eff.runResult(Optic.set([1, 2, 3], mapOptic, [4, 6, 8]))

            if (result.type === 'err') {
                throw new Error('Expected an array but got an error')
            }

            expect(result.value).toEqual([2, 3, 4])
        })
    })

    describe('filter()', () => {
        const filterOptic = Optic.root<number[]>().filter((n) => n > 2)

        it('should filter array items', () => {
            const result = Eff.runResult(Optic.get([1, 2, 3, 4], filterOptic))

            if (result.type === 'err') {
                throw new Error('Expected a number but got an error')
            }

            expect(result.value).toEqual([3, 4])
        })

        it('should set filtered array', () => {
            const result = Eff.runResult(Optic.set([1, 2, 3, 4], filterOptic, [30, 40]))

            if (result.type === 'err') {
                throw new Error('Expected an array but got an error')
            }

            expect(result.value).toEqual([1, 2, 30, 40])
        })
    })

    describe('object()', () => {
        const rootOptic = Optic.root<{ a: number; b: string }>()

        const objOptic = Optic.object({
            a: rootOptic.prop('a'),
            b: rootOptic.prop('b'),
        })

        it('should create object optic', () => {
            const rootValue = { a: 42, b: 'test' }
            const result = Eff.runResult(Optic.get(rootValue, objOptic))

            if (result.type === 'err') {
                throw new Error('Expected an object but got an error')
            }

            expect(result.value).toEqual({ a: 42, b: 'test' })
        })

        it('should set object properties', () => {
            const result = Eff.runResult(Optic.set({ a: 42, b: 'test' }, objOptic, { a: 100, b: 'updated' }))

            if (result.type === 'err') {
                throw new Error('Expected an object but got an error')
            }

            expect(result.value).toEqual({ a: 100, b: 'updated' })
        })
    })

    describe('optional()', () => {
        const optOptic = Optic.optional(Optic.root<number>().refine((n) => n > 10))

        it('should handle undefined value', () => {
            const result = Eff.runResult(Optic.get(5, optOptic))

            if (result.type === 'err') {
                throw new Error('Expected an undefined value but got an error')
            }

            expect(result.value).toBeUndefined()
        })

        it('should preserve defined value', () => {
            const result = Eff.runResult(Optic.get(42, optOptic))

            if (result.type === 'err') {
                throw new Error('Expected a number but got an error')
            }

            expect(result.value).toBe(42)
        })
    })

    describe('caching behavior', () => {
        it('should cache prop access', () => {
            const optic = Optic.root<{ a: { value: number } }>().prop('a')

            const obj = {
                a: {
                    value: 42,
                },
            }

            // First access - should cache
            const result1 = Eff.runResult(Optic.get(obj, optic))

            if (result1.type === 'err') {
                throw new Error('Expected number but got error')
            }

            // Second access - should use cache
            const result2 = Eff.runResult(Optic.get(obj, optic))

            if (result2.type === 'err') {
                throw new Error('Expected number but got error')
            }
            expect(result1.value === result2.value).toBe(true)
        })

        it('should cache index access', () => {
            const optic = Optic.root<{ value: number }[]>().index(0)
            const arr = [{ value: 42 }]

            // First access - should cache
            const result1 = Eff.runResult(Optic.get(arr, optic))

            if (result1.type === 'err') {
                throw new Error('Expected number but got error')
            }

            // Second access - should use cache
            const result2 = Eff.runResult(Optic.get(arr, optic))

            if (result2.type === 'err') {
                throw new Error('Expected number but got error')
            }

            expect(result1.value === result2.value).toBe(true)
        })

        it('should cache filter results', () => {
            const optic = Optic.root<{ value: number }[]>()
                .map((item) => item.prop('value'))
                .filter((n) => n > 2)

            const arr = [1, 2, 3, 4].map((n) => ({ value: n }))

            // First access - should cache
            const result1 = Eff.runResult(Optic.get(arr, optic))

            if (result1.type === 'err') {
                throw new Error('Expected array but got error')
            }

            // Second access - should use cache
            const result2 = Eff.runResult(Optic.get(arr, optic))

            if (result2.type === 'err') {
                throw new Error('Expected array but got error')
            }

            expect(result1.value === result2.value).toBe(true)
        })

        it('should cache map operations', () => {
            const optic = Optic.root<{ value: number }[]>()
                .map((item) => item.prop('value'))
                .map({
                    get: (n) => n * 2,
                    set: (newN: number) => newN / 2,
                })

            const arr = [1, 2, 3].map((n) => ({ value: n }))

            // First access - should cache
            const result1 = Eff.runResult(Optic.get(arr, optic))

            if (result1.type === 'err') {
                throw new Error('Expected array but got error')
            }

            // Second access - should use cache
            const result2 = Eff.runResult(Optic.get(arr, optic))
            if (result2.type === 'err') {
                throw new Error('Expected array but got error')
            }

            expect(result1.value === result2.value).toBe(true)
        })

        it('should cache find operations', () => {
            const optic = Optic.root<{ value: number }[]>().find((obj) => obj.value === 42)

            const arr = [1, 42, 3].map((n) => ({ value: n }))

            // First access - should cache
            const result1 = Eff.runResult(Optic.get(arr, optic))

            if (result1.type === 'err') {
                throw new Error('Expected number but got error')
            }

            // Second access - should use cache
            const result2 = Eff.runResult(Optic.get(arr, optic))

            if (result2.type === 'err') {
                throw new Error('Expected number but got error')
            }

            expect(result1.value === result2.value).toBe(true)
        })

        it('should cache refine operations', () => {
            const optic = Optic.root<{ a: { value: number } }>()
                .refine((obj) => obj.a.value > 2)
                .prop('a')

            const okObj = {
                a: {
                    value: 42,
                },
            }

            const errObj = {
                a: {
                    value: 1,
                },
            }

            // First access - should cache
            const result1 = Eff.runResult(Optic.get(okObj, optic))
            const result2 = Eff.runResult(Optic.get(errObj, optic))

            if (result1.type === 'err') {
                throw new Error('Expected number but got error')
            }

            if (result2.type === 'ok') {
                throw new Error('Expected error but got number')
            }

            // Second access - should use cache
            const result3 = Eff.runResult(Optic.get(okObj, optic))
            const result4 = Eff.runResult(Optic.get(errObj, optic))

            if (result3.type === 'err') {
                throw new Error('Expected number but got error')
            }

            if (result4.type === 'ok') {
                throw new Error('Expected error but got number')
            }

            expect(result1.value === result3.value).toBe(true)
            expect(result2.type === result4.type).toBe(true)
        })

        it('should cache nested object operations', () => {
            const optic = Optic.root<{ a: { b: number }[] }>().prop('a').index(1)

            const obj = {
                a: [{ b: 42 }, { b: 100 }],
            }

            // First access - should cache
            const result1 = Eff.runResult(Optic.get(obj, optic))

            if (result1.type === 'err') {
                throw new Error('Expected number but got error')
            }

            // Second access - should use cache

            const result2 = Eff.runResult(Optic.get(obj, optic))

            if (result2.type === 'err') {
                throw new Error('Expected number but got error')
            }

            expect(result1.value === result2.value).toBe(true)
        })
    })

    describe('complex combinations', () => {
        it('should combine prop + refine + map', () => {
            const optic = Optic.root<{ a: number[] }>()
                .prop('a')
                .refine((arr: number[]) => arr.length > 0)
                .map({
                    get: (value) => value * 2,
                    set: (newValue: number) => newValue / 2,
                })

            const result = Eff.runResult(Optic.get({ a: [1, 2, 3] }, optic))

            if (result.type === 'err') {
                throw new Error('Expected array but got error')
            }

            expect(result.value).toEqual([2, 4, 6])

            const setResult = Eff.runResult(Optic.set({ a: [1, 2, 3] }, optic, [4, 6, 8]))

            if (setResult.type === 'err') {
                throw new Error('Expected array but got error')
            }

            expect(setResult.value).toEqual({ a: [2, 3, 4] })

            const errResult = Eff.runResult(Optic.get({ a: [] }, optic))

            expect(errResult.type).toBe('err')
        })

        it('should combine index + filter + match', () => {
            const optic = Optic.root<(string | number)[]>()
                .filter((v) => typeof v === 'number')
                .index(0)

            let result = Eff.runResult(Optic.get([42, 'test', 100], optic))

            if (result.type === 'err') {
                throw new Error('Expected number but got error')
            }

            expect(result.value).toBe(42)

            result = Eff.runResult(Optic.get(['test', 42], optic))

            if (result.type === 'err') {
                throw new Error('Expected number but got error')
            }

            expect(result.value).toBe(42)

            result = Eff.runResult(Optic.get(['test', 'test'], optic))

            if (result.type === 'ok') {
                throw new Error('Expected error but got number')
            }

            expect(result.type).toBe('err')
        })

        it('should handle nested object operations', () => {
            const optic = Optic.root<{ user: { profile: { name: string; age: number } } }>()
                .prop('user')
                .prop('profile')

            const result = Eff.runResult(Optic.get({ user: { profile: { name: 'Alice', age: 25 } } }, optic))

            if (result.type === 'err') {
                throw new Error('Expected object but got error')
            }

            expect(result.value).toEqual({ name: 'Alice', age: 25 })

            const setResult = Eff.runResult(
                Optic.set({ user: { profile: { name: 'Alice', age: 25 } } }, optic, {
                    name: 'Bob',
                    age: 30,
                }),
            )

            if (setResult.type === 'err') {
                throw new Error('Expected object but got error')
            }

            expect(setResult.value).toEqual({
                user: { profile: { name: 'Bob', age: 30 } },
            })
        })

        it('fails when updating a non-existent array item', () => {
            const optic = Optic.root<{ items: { value: number }[] }>().prop('items').index(5)

            const result = Eff.runResult(Optic.set({ items: [{ value: 1 }, { value: 2 }] }, optic, { value: 100 }))

            expect(result.type).toBe('err')
        })
    })

    describe('select()', () => {
        it('should do nothing if no operations are provided', () => {
            const rootOptic = Optic.root<number>()
            const optic = rootOptic.select((p) => p)
            const result = Eff.runResult(Optic.get(42, optic))

            expect(optic === rootOptic).toBe(true)

            if (result.type === 'err') {
                throw new Error('Expected a number but got an error')
            }

            expect(result.value).toBe(42)
        })

        it('should create optic from property access', () => {
            const optic = Optic.root<{ a: number }>().select((p) => p.a)

            const result = Eff.runResult(Optic.get({ a: 42 }, optic))

            if (result.type === 'err') {
                throw new Error('Expected number but got error')
            }

            expect(result.value).toBe(42)
        })

        it('should create optic from index access', () => {
            const optic = Optic.root<number[]>().select((p) => p[0])
            const result = Eff.runResult(Optic.get([42], optic))

            if (result.type === 'err') {
                throw new Error('Expected number but got error')
            }

            expect(result.value).toBe(42)
        })

        it('should chain multiple operations', () => {
            const optic = Optic.root<{ items: { value: number }[] }>().select((p) => p.items[0].value)

            const result = Eff.runResult(Optic.get({ items: [{ value: 42 }] }, optic))

            if (result.type === 'err') {
                throw new Error('Expected number but got error')
            }

            expect(result.value).toBe(42)
        })

        it('should maintain type inference', () => {
            const optic = Optic.root<{ a: { b: string } }>().select((p) => p.a.b)

            const result = Eff.runResult(Optic.get({ a: { b: 'test' } }, optic))

            if (result.type === 'err') {
                throw new Error('Expected string but got error')
            }

            expect(result.value).toBe('test')
        })

        it('should support deep, nesting, mixed prop/index accessing', () => {
            type State = {
                a: {
                    b: {
                        c: {
                            e: {
                                f: {
                                    g: {
                                        h: string
                                    }[]
                                }
                            }
                        }[]
                    }
                }
            }
            const optic: Optic<string, State> = Optic.root<State>().select(
                (p: OpticProxy<State>): OpticProxy<string> => p.a.b.c[1].e.f.g[2].h,
            )

            const state: State = {
                a: {
                    b: {
                        c: [
                            { e: { f: { g: [{ h: 'first' }] } } },
                            { e: { f: { g: [{ h: 'second' }, { h: 'third' }, { h: 'target' }] } } },
                        ],
                    },
                },
            }

            const result = Eff.runResult(Optic.get(state, optic)) // should return 'target'

            if (result.type === 'err') {
                throw new Error('Expected string but got error')
            }

            expect(result.value).toBe('target')
        })
    })
})
