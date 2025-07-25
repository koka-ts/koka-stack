import { Err, Result, isGenerator, Async, StreamResult, StreamResults } from '../src'
import * as Eff from '../src'

const delayTime = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('Result', () => {
    it('should create ok result', () => {
        const ok = Result.ok(42)
        expect(ok.type).toBe('ok')
        expect(ok.value).toBe(42)
    })

    it('should create err result', () => {
        const err = Result.err('TestError', 'error message')
        expect(err.type).toBe('err')
        expect(err.name).toBe('TestError')
        expect(err.error).toBe('error message')
    })
})

describe('Eff.throw', () => {
    it('should throw error effect', () => {
        class TestError extends Eff.Err('TestError')<string> {}

        function* test() {
            yield* Eff.throw(new TestError('error message'))
            return 'should not reach here'
        }

        const result = Eff.run(Eff.result(test()))

        expect(result).toEqual({
            type: 'err',
            name: 'TestError',
            error: 'error message',
        })
    })
})

describe('Eff.get', () => {
    it('should get context value', () => {
        class TestCtx extends Eff.Ctx('TestCtx')<number> {}
        class Num extends Eff.Ctx('Num')<number> {}

        function* test() {
            const value = yield* Eff.get(TestCtx)
            const num = yield* Eff.get(Num)
            return value * num
        }

        const program0 = Eff.try(test()).handle({
            Num: 2,
        })

        const program1 = Eff.try(program0).handle({
            TestCtx: 21,
        })

        const result = Eff.run(program1)
        expect(result).toBe(42)
    })

    it('should propagate context when not handled', () => {
        class TestCtx extends Eff.Ctx('TestCtx')<number> {}

        function* inner() {
            return yield* Eff.get(TestCtx)
        }

        function* outer() {
            return yield* inner()
        }

        const program = Eff.try(outer()).handle({
            TestCtx: 42,
        })

        const result = Eff.run(program)
        expect(result).toBe(42)
    })
})

describe('Eff.try', () => {
    it('should throw for unhandled effect types', () => {
        function* test() {
            yield { type: 'unknown' } as any
            return 'should not reach here'
        }

        expect(() => {
            Eff.run(Eff.try(test()).handle({}))
        }).toThrow()
    })

    it('should catch error effect', () => {
        class TestError extends Eff.Err('TestError')<string> {}

        function* test() {
            yield* Eff.throw(new TestError('error'))
            return 'should not reach here'
        }

        const program = Eff.try(test()).handle({
            TestError: (error) => `Caught: ${error}`,
        })

        const result = Eff.run(program)
        expect(result).toBe('Caught: error')
    })

    it('should propagate unhandled error', () => {
        class UnhandledError extends Eff.Err('UnhandledError')<string> {}

        function* test() {
            yield* Eff.throw(new UnhandledError('error'))
            return 'should not reach here'
        }

        const program = Eff.try(test()).handle({})

        const result = Eff.run(
            Eff.try(program).handle({
                UnhandledError: (error) => ({ error }),
            }),
        )

        expect(result).toEqual({
            error: 'error',
        })
    })

    it('should handle multiple catches', () => {
        class TestCtx extends Eff.Ctx('TestCtx')<() => 1> {}
        class FirstError extends Eff.Err('FirstError')<string> {}
        class SecondError extends Eff.Err('SecondError')<string> {}

        function* test() {
            yield* Eff.get(TestCtx)
            yield* Eff.throw(new FirstError('first error'))
            yield* Eff.throw(new SecondError('second error'))
            return 'should not reach here'
        }

        const program = Eff.try(test()).handle({
            FirstError: (error) => `Caught first: ${error}`,
            SecondError: (error) => `Caught second: ${error}`,
            TestCtx: () => 1,
        })

        const result = Eff.runSync(program)
        expect(result).toBe('Caught first: first error')
    })

    it('should handle nested try/catch', () => {
        class InnerError extends Eff.Err('InnerError')<string> {}

        function* inner() {
            yield* Eff.throw(new InnerError('inner error'))
            return 'should not reach here'
        }

        function* outer() {
            return yield* inner()
        }

        const result = Eff.run(
            Eff.try(outer()).handle({
                InnerError: (error) => `Caught inner: ${error}`,
            }),
        )
        expect(result).toBe('Caught inner: inner error')
    })
})

describe('Eff.run', () => {
    it('should handle async effects', async () => {
        function* test() {
            const value = yield* Eff.await(Promise.resolve(42))
            const syncValue = yield* Eff.await(2)
            return value * syncValue
        }

        const result = await Eff.runAsync(test())
        expect(result).toBe(84)
    })

    it('should handle mixed sync/async effects', async () => {
        function* test() {
            const syncValue = 21
            const asyncValue = yield* Eff.await(Promise.resolve(21))
            return syncValue + asyncValue
        }

        const result = await Eff.run(test())
        expect(result).toBe(42)
    })

    it('should handle errors in async effects', async () => {
        function* testThrow() {
            yield* Eff.await(Promise.reject(new Error('Async error')))
        }

        function* test() {
            try {
                yield* testThrow()
            } catch (err) {
                if (err instanceof Error) {
                    return `Caught: ${err.message}`
                }
            }
        }

        const result = await Eff.run(test())
        expect(result).toBe('Caught: Async error')
    })

    it('should throw error when received unexpected effect type', () => {
        class TestErr extends Eff.Err('TestErr')<string> {}
        class TestCtx extends Eff.Ctx('TestCtx')<string> {}
        class TestOpt extends Eff.Opt('TestOpt')<string> {}

        function* testErr(): Generator<TestErr, string> {
            yield* Eff.throw(new TestErr('error'))
            return 'should not reach here'
        }

        function* testCtx(): Generator<TestCtx, string> {
            const ctx = yield* Eff.get(TestCtx)
            return ctx
        }

        function* testOpt(): Generator<TestOpt, string> {
            const opt = yield* Eff.get(TestOpt)
            return opt ?? 'default'
        }

        // @ts-expect-error for test
        expect(() => Eff.run(testErr())).toThrow(/\w+/)
        // @ts-expect-error for test
        expect(() => Eff.run(testCtx())).toThrow(/\w+/)

        expect(Eff.run(testOpt())).toBe('default')

        expect(
            Eff.run(
                Eff.try(testOpt()).handle({
                    [TestOpt.field]: 'custom value',
                }),
            ),
        ).toBe('custom value')
    })
})

describe('Eff.runSync', () => {
    it('should run sync effects', () => {
        function* test() {
            return 42
        }

        const result = Eff.runSync(test())
        expect(result).toBe(42)
    })

    it('should throw for async effects', () => {
        function* test(): Generator<Async, number> {
            yield* Eff.await(Promise.resolve(42))
            return 42
        }

        // @ts-expect-error for test
        expect(() => Eff.runSync(test())).toThrow(/Expected synchronous effect, but got asynchronous effect/)
    })
})

describe('Eff.result', () => {
    it('should convert generator to Result', () => {
        class TestCtx extends Eff.Ctx('TestCtx')<string> {}
        class TestError extends Eff.Err('TestError')<string> {}

        function* success() {
            return 42
        }

        function* failure() {
            const message = yield* Eff.get(TestCtx)
            yield* Eff.throw(new TestError(message))
            return 'should not reach here'
        }

        const successResult = Eff.run(Eff.result(success()))

        expect(successResult).toEqual({
            type: 'ok',
            value: 42,
        })

        const failureResult = Eff.run(
            Eff.try(Eff.result(failure())).handle({
                TestCtx: 'error',
            }),
        )
        expect(failureResult).toEqual({
            type: 'err',
            name: 'TestError',
            error: 'error',
        })
    })

    it('should throw err result', () => {
        function* failure() {
            throw new Error('TestError')
        }

        function* test() {
            try {
                yield* failure()
                return 'should not reach here'
            } catch (err) {
                if (err instanceof Error) {
                    return `Caught: ${err.message}`
                }
            }
        }

        const result = Eff.run(Eff.result(test()))

        expect(result).toEqual({
            type: 'ok',
            value: 'Caught: TestError',
        })
    })
})

describe('Eff.ok', () => {
    it('test success', () => {
        function* success() {
            return Result.ok(42)
        }

        function* testSuccess() {
            const value = yield* Eff.ok(success())
            return value
        }

        const result = Eff.run(testSuccess)

        expect(result).toBe(42)
    })

    it('test failure', () => {
        class TestError extends Eff.Err('TestError')<string> {}

        function* testFailure() {
            yield* Eff.ok(Eff.result(Eff.throw(new TestError('error'))))
        }

        const failureResult = Eff.run(
            Eff.try(testFailure).handle({
                TestError: (error) => `Caught: ${error}`,
            }),
        )

        expect(failureResult).toBe('Caught: error')
    })
})

describe('Eff.runResult', () => {
    it('should run generator and return Result', async () => {
        class ZeroError extends Eff.Err('ZeroError')<string> {}

        function* program(input: number) {
            const value = yield* Eff.await(Promise.resolve(input))

            if (value === 0) {
                yield* Eff.throw(new ZeroError('value is zero'))
            }

            return value
        }

        const result = await Eff.runResult(program(42))

        expect(result).toEqual({
            type: 'ok',
            value: 42,
        })
    })

    it('should handle error in generator', () => {
        class TestError extends Eff.Err('TestError')<string> {}

        function* program() {
            yield* Eff.throw(new TestError('error message'))
            return 'should not reach here'
        }

        const result = Eff.runResult(program)

        expect(result).toEqual({
            type: 'err',
            name: 'TestError',
            error: 'error message',
        })
    })
})

describe('Complex scenarios', () => {
    it('should handle successful nested effects', async () => {
        class TestCtx extends Eff.Ctx('TestCtx')<number> {}

        function* program() {
            const ctxValue = yield* Eff.get(TestCtx)
            const asyncValue = yield* Eff.await(Promise.resolve(ctxValue * 2))
            return asyncValue + 1
        }

        const result = await Eff.run(
            Eff.try(program()).handle({
                TestCtx: 21,
            }),
        )
        expect(result).toBe(43)
    })

    it('should handle error in nested effects', async () => {
        class TestCtx extends Eff.Ctx('TestCtx')<number> {}
        class ZeroError extends Eff.Err('ZeroError')<string> {}

        function* program() {
            const ctxValue = yield* Eff.get(TestCtx)
            if (ctxValue === 0) {
                yield* Eff.throw(new ZeroError('ctx is zero'))
            }
            const asyncValue = yield* Eff.await(Promise.resolve(ctxValue * 2))
            return asyncValue + 1
        }

        const result = await Eff.run(
            Eff.try(program()).handle({
                TestCtx: 0,
                e: 1,
                ZeroError: (error) => `Handled: ${error}`,
            }),
        )

        expect(result).toBe('Handled: ctx is zero')
    })
})

describe('Eff.Ctx/Eff.Err', () => {
    it('should create context effect class', () => {
        class TestCtx extends Eff.Ctx('TestCtx')<number> {}

        const ctx = new TestCtx()
        ctx.context = 42

        expect(ctx.type).toBe('ctx')
        expect(ctx.name).toBe('TestCtx')
        expect(ctx.context).toBe(42)
    })

    it('should create error effect class', () => {
        class TestErr extends Eff.Err('TestErr')<string> {}
        const err = new TestErr('error')

        expect(err.type).toBe('err')
        expect(err.name).toBe('TestErr')
        expect(err.error).toBe('error')
    })
})

describe('Eff.throw', () => {
    it('should throw error effect', () => {
        class TestErr extends Eff.Err('TestErr')<string> {}

        function* test() {
            yield* Eff.throw(new TestErr('error'))
            return 'should not reach here'
        }

        const result = Eff.run(Eff.result(test()))

        expect(result).toEqual(new TestErr('error'))
    })

    it('should propagate error through nested calls', () => {
        const TestErr = Eff.Err('TestErr')<string>

        function* inner() {
            yield* Eff.throw(new TestErr('inner error'))
            return 'should not reach here'
        }

        function* outer() {
            return yield* inner()
        }

        const result = Eff.run(Eff.result(outer()))
        expect(result).toEqual(new TestErr('inner error'))
    })
})

describe('Eff.get', () => {
    it('should get context value', () => {
        const TestCtx = Eff.Ctx('TestCtx')<number>

        function* test() {
            const value = yield* Eff.get(TestCtx)
            return value * 2
        }

        const program = Eff.try(test()).handle({
            TestCtx: 42,
        })

        const result = Eff.run(program)
        expect(result).toBe(84)
    })

    it('should propagate context when not handled', () => {
        const TestCtx = Eff.Ctx('TestCtx')<number>

        function* inner() {
            return yield* Eff.get(TestCtx)
        }

        function* outer() {
            return yield* inner()
        }

        const program = Eff.try(outer()).handle({
            TestCtx: 42,
        })

        const result = Eff.run(program)
        expect(result).toBe(42)
    })
})

describe('helpers', () => {
    it('should check if value is a generator', () => {
        function* gen() {}
        const notGen = () => {}

        expect(isGenerator(gen())).toBe(true)
        expect(isGenerator(notGen())).toBe(false)
    })
})

describe('Eff.combine', () => {
    it('should handle sync effects with array input', async () => {
        function* effect1() {
            return 1
        }

        function* effect2() {
            return '2'
        }

        function* program() {
            const combined: Generator<Async, [number, string]> = Eff.combine([effect1(), effect2()])
            const results = yield* combined
            return results[0] + Number(results[1])
        }

        const result = await Eff.runAsync(program())
        expect(result).toBe(3)
    })

    it('should handle async effects with array input', async () => {
        function* effect1() {
            return yield* Eff.await(Promise.resolve(1))
        }

        function* effect2() {
            return yield* Eff.await(Promise.resolve('2'))
        }

        function* program() {
            const combined: Generator<Async, [number, string]> = Eff.combine([effect1(), effect2()])
            const results = yield* combined
            return results[0] + Number(results[1])
        }

        const result = await Eff.run(program())
        expect(result).toBe(3)
    })

    it('should handle mixed sync/async effects with array input', async () => {
        function* syncEffect() {
            return 1
        }

        function* asyncEffect() {
            return yield* Eff.await(Promise.resolve(2))
        }

        function* program() {
            const combined: Generator<Async, [number, number]> = Eff.combine([syncEffect(), asyncEffect()] as const)
            const results = yield* combined
            return results[0] + results[1]
        }

        const result = await Eff.run(program())
        expect(result).toBe(3)
    })

    it('should handle object input with generators', async () => {
        function* effect1() {
            return 1
        }

        function* effect2() {
            return 2
        }

        function* program() {
            const results: {
                a: number
                b: number
                c: number
            } = yield* Eff.combine({
                a: effect1(),
                b: effect2(),
                c: 3,
            })
            return results.a + results.b + results.c
        }

        const result = await Eff.run(program())
        expect(result).toBe(6)
    })

    it('should handle mixed object input with generators and values', async () => {
        function* effect1() {
            return 1
        }

        function* program() {
            const results: {
                a: number
                b: number
                c: number
            } = yield* Eff.combine({
                a: effect1(),
                b: 2,
                c: () => effect1(),
            })
            return results.a + results.b + results.c
        }

        const result = await Eff.run(program())
        expect(result).toBe(4)
    })

    it('should handle errors in object input', () => {
        class TestErr extends Eff.Err('TestErr')<string> {}

        function* effect1() {
            return 1
        }

        function* effect2() {
            yield* Eff.throw(new TestErr('error'))
            return 2
        }

        function* program() {
            const results: {
                a: number
                b: number
            } = yield* Eff.combine({
                a: effect1(),
                b: effect2(),
            })
            return results.a + results.b
        }

        const result = Eff.run(Eff.result(program()))
        expect(result).toEqual({
            type: 'err',
            name: 'TestErr',
            error: 'error',
        })
    })

    it('should handle empty object input', async () => {
        function* program(): Generator<Async, {}> {
            const results: {} = yield* Eff.combine({})
            return results
        }

        const result = await Eff.run(program())
        expect(result).toEqual({})
    })

    it('should handle multiple async effects and run concurrently', async () => {
        function* delayedEffect<T>(value: T, delay: number) {
            if (delay === 0) {
                class DelayError extends Eff.Err('DelayError')<string> {}
                yield* Eff.throw(new DelayError('Delay cannot be zero'))
            }

            yield* Eff.await(delayTime(delay))

            return value
        }

        function* program() {
            const combined: Generator<Async | Err<'DelayError', string>, [number, string, boolean]> = Eff.combine([
                delayedEffect(1, 30),
                delayedEffect('2', 20),
                delayedEffect(false, 10),
            ])

            const results = yield* combined
            return results
        }

        const start = Date.now()
        const result = await Eff.runResult(program())
        const duration = Date.now() - start

        expect(result).toEqual({
            type: 'ok',
            value: [1, '2', false],
        })

        // Should run program in parallel
        expect(duration).toBeLessThan(50) // Should complete in less than 50ms
    })

    it('should handle empty array', async () => {
        function* program(): Generator<Async, []> {
            const results = yield* Eff.combine([])
            return results
        }

        const result = await Eff.run(program())
        expect(result).toEqual([])
    })

    it('should handle function effects', async () => {
        function* effect1(): Generator<never, number> {
            return 1
        }

        function* effect2(): Generator<never, number> {
            return 2
        }

        function* program(): Generator<Async, number> {
            const results = yield* Eff.combine([() => effect1(), () => effect2()])
            return results[0] + results[1]
        }

        const result = await Eff.run(program())
        expect(result).toBe(3)
    })

    it('should handle async errors with native try-catch', async () => {
        function* effectWithError(): Generator<Async, number> {
            const value = yield* Eff.await(Promise.reject(new Error('Async error')))
            return value
        }

        function* program() {
            try {
                const results = yield* Eff.combine([effectWithError(), Eff.await(Promise.resolve(2))])
                return results[0] + results[1]
            } catch (err: unknown) {
                return err as Error
            }
        }

        const result = await Eff.run(program())

        expect(result).toBeInstanceOf(Error)
        expect((result as Error).message).toBe('Async error')
    })

    it('should propagate async errors', async () => {
        function* failingEffect(): Generator<Async, never> {
            yield* Eff.await(Promise.reject(new Error('Async error')))
            /* istanbul ignore next */
            throw new Error('Should not reach here')
        }

        function* program(): Generator<Async, number> {
            const results = yield* Eff.combine([failingEffect(), Eff.await(Promise.resolve(2))])
            return results[0] + results[1]
        }

        await expect(Eff.run(program())).rejects.toThrow('Async error')
    })

    it('should handle thrown errors in async effects', async () => {
        function* effectWithThrow(): Generator<Async, number> {
            const value = yield* Eff.await(
                new Promise<number>((_, reject) => {
                    setTimeout(() => {
                        try {
                            throw new Error('Thrown error')
                        } catch (err) {
                            reject(err)
                        }
                    }, 10)
                }),
            )
            return value
        }

        function* program(): Generator<Async, number> {
            try {
                const results = yield* Eff.combine([effectWithThrow(), Eff.await(Promise.resolve(2))])
                return results[0] + results[1]
            } catch (err) {
                if (err instanceof Error) {
                    return -100
                }
                throw err
            }
        }

        const result = await Eff.run(program())
        expect(result).toBe(-100)
    })
})

describe('Eff.race', () => {
    it('should interrupt other effects when one resolves', async () => {
        let cleanupCalled = false

        function* slowEffect() {
            try {
                yield* Eff.await(new Promise((resolve) => setTimeout(resolve, 100)))
                return 'slow'
            } finally {
                cleanupCalled = true
            }
        }

        function* fastEffect() {
            return 'fast'
        }

        const inputs = [slowEffect(), fastEffect()]
        const result = await Eff.run(Eff.race(inputs))

        expect(result).toBe('fast')
        expect(cleanupCalled).toBe(true)
    })
})

describe('Eff.all', () => {
    it('should handle errors in effects', () => {
        class TestErr extends Eff.Err('TestErr')<string> {}

        function* effect1() {
            return 1
        }

        function* effect2() {
            yield* Eff.throw(new TestErr('error'))
            return 2
        }

        function* program() {
            const results = yield* Eff.all([effect1(), effect2()])
            return results[0] + results[1]
        }

        const result = Eff.run(Eff.result(program()))
        expect(result).toEqual({
            type: 'err',
            name: 'TestErr',
            error: 'error',
        })
    })

    it('should handle effect list with the same item type', async () => {
        function* effect1(): Generator<Async, number> {
            yield* Eff.await(Promise.resolve(1))
            return 1
        }

        function* effect2(): Generator<never, number> {
            return 2
        }

        function* program() {
            const list = [effect1(), effect2()]
            const results = yield* Eff.all(list)
            return results
        }

        const result = await Eff.run(program())
        expect(result).toEqual([1, 2])
    })
})

describe('Eff.opt', () => {
    it('should return undefined when no value provided', () => {
        class TestOpt extends Eff.Opt('TestOpt')<number> {}

        function* test() {
            return yield* Eff.get(TestOpt)
        }

        const result = Eff.run(test())
        expect(result).toBeUndefined()
    })

    it('should return value when provided', () => {
        class TestOpt extends Eff.Opt('TestOpt')<number> {}

        function* test() {
            const optValue = yield* Eff.get(TestOpt)
            return optValue ?? 42
        }

        const result = Eff.run(Eff.try(test()).handle({ TestOpt: 21 }))
        expect(result).toBe(21)
    })

    it('should work with async effects', async () => {
        class TestOpt extends Eff.Opt('TestOpt')<number> {}

        function* test() {
            const optValue = yield* Eff.get(TestOpt)
            const asyncValue = yield* Eff.await(Promise.resolve(optValue ?? 42))
            return asyncValue
        }

        const result = await Eff.run(test())
        expect(result).toBe(42)
    })

    it('should handle undefined context value', () => {
        class TestOpt extends Eff.Opt('TestOpt')<number> {}

        function* test() {
            const optValue = yield* Eff.get(TestOpt)
            return optValue ?? 100
        }

        const result = Eff.run(Eff.try(test()).handle({ TestOpt: undefined }))
        expect(result).toBe(100)
    })
})

describe('Eff.stream', () => {
    it('should clean up pending effects on early return', async () => {
        const cleanUp = jest.fn()
        const returnFn = jest.fn()

        function* valueGen(n: number) {
            try {
                yield* Eff.await(Promise.resolve(1))
                returnFn()
                return 1
            } finally {
                cleanUp(n)
            }
        }

        const inputs = [valueGen(0), valueGen(1), valueGen(2), valueGen(3)]
        const handler = async (_stream: StreamResults<number>) => {
            // Early return without consuming all results
            return 42
        }

        const result = await Eff.run(Eff.stream(inputs, handler))
        expect(result).toBe(42)
        expect(returnFn).toHaveBeenCalledTimes(0)
        expect(cleanUp).toHaveBeenCalledTimes(4)
    })

    it('should clean up pending effects on early return in for-await-of block', async () => {
        const cleanUp = jest.fn()
        const returnFn = jest.fn()

        function* produce(n: number) {
            try {
                yield* Eff.await(delayTime(n))
                returnFn()
                return n
            } finally {
                cleanUp(n)
            }
        }

        const inputs = [produce(40), produce(20), produce(30), produce(10)]

        const handler = async (stream: StreamResults<number>) => {
            const results = [] as StreamResult<number>[]

            for await (const result of stream) {
                results.push(result)

                if (results.length === 2) {
                    return results
                }
            }

            throw new Error('Early return')
        }

        const results = await Eff.run(Eff.stream(inputs, handler))

        expect(results).toEqual([
            { index: 3, value: 10 },
            { index: 1, value: 20 },
        ])

        expect(returnFn).toHaveBeenCalledTimes(2)
        expect(cleanUp).toHaveBeenCalledTimes(4)
    })

    it('should process stream of values', async () => {
        function* valueGen(value: number) {
            return value
        }

        const inputs = [valueGen(1), valueGen(2), valueGen(3)]

        const program = Eff.stream(inputs, async (stream) => {
            const results = [] as number[]

            for await (const { index, value } of stream) {
                results[index] = value * 2
            }

            return results
        })

        const result = await Eff.run(program)
        expect(result).toEqual([2, 4, 6])
    })

    it('should handle empty input stream', async () => {
        const program = Eff.stream([] as Generator<never, number>[], async (stream) => {
            const results = [] as number[]

            for await (const { index, value } of stream) {
                results[index] = value * 2
            }
            return results
        })

        const result = await Eff.runAsync(program)

        expect(result).toEqual([])
    })

    it('should handle async effects in stream', async () => {
        function* asyncValueGen(value: number) {
            const asyncValue = yield* Eff.await(Promise.resolve(value))
            return asyncValue
        }

        const inputs = [asyncValueGen(1), asyncValueGen(2), asyncValueGen(3)]

        const handler = async (stream: StreamResults<number>) => {
            const results = [] as number[]
            for await (const { index, value } of stream) {
                results[index] = value * 2
            }
            return results
        }

        const program = Eff.stream(inputs, handler)

        const result = await Eff.run(program)
        expect(result).toEqual([2, 4, 6])
    })

    it('should propagate errors from stream items', async () => {
        class StreamError extends Eff.Err('StreamError')<string> {}

        function* failingGen() {
            yield* Eff.throw(new StreamError('stream error'))
            return 1
        }

        const inputs = [failingGen()]
        const handler = async (stream: StreamResults<number>) => {
            const results = [] as number[]
            for await (const { value } of stream) {
                results.push(value)
            }
            return results
        }

        const result = await Eff.runResult(Eff.stream(inputs, handler))

        expect(result).toEqual({
            type: 'err',
            name: 'StreamError',
            error: 'stream error',
        })
    })

    it('should handle mixed sync/async stream items', async () => {
        function* syncGen() {
            return 1
        }

        function* asyncGen() {
            return yield* Eff.await(Promise.resolve(2))
        }

        const inputs = [syncGen(), asyncGen()]
        const handler = async (stream: StreamResults<number>) => {
            const results = [] as number[]

            for await (const { index, value } of stream) {
                results[index] = value * 2
            }

            return results
        }

        const result = await Eff.run(Eff.stream(inputs, handler))

        expect(result).toEqual([2, 4])
    })

    it('should clean up generators on error', async () => {
        class CleanupError extends Eff.Err('CleanupError')<string> {}

        let cleanupCalled = false
        function* failingGen() {
            try {
                yield* Eff.throw(new CleanupError('cleanup error'))
                return 1
            } finally {
                cleanupCalled = true
            }
        }

        const inputs = [failingGen()]
        const handler = async (stream: StreamResults<number>) => {
            try {
                for await (const { value } of stream) {
                    return value
                }
                return 0
            } catch {
                return -1
            }
        }

        const result = await Eff.run(Eff.result(Eff.stream(inputs, handler)))
        expect(result).toEqual({
            type: 'err',
            name: 'CleanupError',
            error: 'cleanup error',
        })
        expect(cleanupCalled).toBe(true)
    })

    it('should handle unexpected completion errors in stream', async () => {
        function* normalGen() {
            return 42
        }

        const inputs = [normalGen()]
        const handler = async (stream: StreamResults<number>) => {
            const results = []
            for await (const result of stream) {
                results.push(result)
            }
            return results
        }

        // This should not throw an unexpected completion error
        const result = await Eff.run(Eff.stream(inputs, handler))
        expect(result).toEqual([{ index: 0, value: 42 }])
    })

    it('should handle stream with mixed sync and async effects', async () => {
        function* syncGen() {
            return 1
        }

        function* asyncGen() {
            const value = yield* Eff.await(Promise.resolve(2))
            return value
        }

        const inputs = [syncGen(), asyncGen()]
        const handler = async (stream: StreamResults<number>) => {
            const results = []
            for await (const result of stream) {
                results.push(result)
            }
            return results
        }

        const result = await Eff.run(Eff.stream(inputs, handler))
        expect(result).toEqual([
            { index: 0, value: 1 },
            { index: 1, value: 2 },
        ])
    })

    it('should handle stream handler that resolves correctly', async () => {
        function* gen() {
            return 42
        }

        const inputs = [gen()]
        const handler = async (stream: StreamResults<number>) => {
            for await (const result of stream) {
                return result.value * 2
            }
            return 0
        }

        const result = await Eff.run(Eff.stream(inputs, handler))
        expect(result).toBe(84)
    })
})

describe('design first approach', () => {
    // predefined error effects
    class UserNotFound extends Eff.Err('UserNotFound')<string> {}
    class UserInvalid extends Eff.Err('UserInvalid')<{ reason: string }> {}

    // predefined context effects
    class AuthToken extends Eff.Ctx('AuthToken')<string> {}
    class UserId extends Eff.Ctx('UserId')<string> {}

    // predefined option effects
    class LoggerOpt extends Eff.Opt('Logger')<(message: string) => void> {}

    // Helper functions using the defined types
    function* requireUserId() {
        const logger = yield* Eff.get(LoggerOpt)
        const userId = yield* Eff.get(UserId)

        if (!userId) {
            logger?.('User ID is missing, throwing UserInvalidErr')
            throw yield* Eff.throw(new UserInvalid({ reason: 'Missing user ID' }))
        }

        logger?.(`User ID: ${userId}`)

        return userId
    }

    function* getUser() {
        const userId = yield* requireUserId()

        const authToken = yield* Eff.get(AuthToken)

        if (!authToken) {
            yield* Eff.throw(new UserInvalid({ reason: 'Missing auth token' }))
        }

        // Simulate fetching user logic
        const user: { id: string; name: string } | null = yield* Eff.await(null)

        if (!user) {
            yield* Eff.throw(new UserNotFound(`User with ID ${userId} not found`))
        }

        return user
    }

    it('should support design first approach', async () => {
        const program = Eff.try(getUser()).handle({
            [UserNotFound.field]: (error) => `Error: ${error}`,
            [UserInvalid.field]: (error) => `Invalid user: ${JSON.stringify(error)}`,
            [AuthToken.field]: 'valid-token',
            [UserId.field]: '12345',
        })

        const result = await Eff.run(program)

        expect(result).toBe('Error: User with ID 12345 not found')
    })

    it('should support optional effects', async () => {
        const logs = [] as string[]
        const logger = (message: string) => {
            logs.push(message)
        }

        const program = Eff.try(getUser()).handle({
            UserNotFound: (error) => `Error: ${error}`,
            UserInvalid: (error) => `Invalid user: ${JSON.stringify(error, null, 2)}`,
            AuthToken: 'valid-token',
            UserId: '12345',
            Logger: logger,
        })

        let result = await Eff.run(program)

        expect(result).toBe('Error: User with ID 12345 not found')
        expect(logs).toEqual(['User ID: 12345'])

        result = await Eff.run(
            Eff.try(getUser()).handle({
                UserNotFound: (error) => `Error: ${error}`,
                UserInvalid: (error) => `Invalid user: ${JSON.stringify(error, null, 2)}`,
                AuthToken: 'valid-token',
                UserId: '', // Simulate missing user ID
                Logger: logger,
            }),
        )

        expect(result).toBe(`Invalid user: ${JSON.stringify({ reason: 'Missing user ID' }, null, 2)}`)
        expect(logs).toEqual(['User ID: 12345', 'User ID is missing, throwing UserInvalidErr'])
    })
})

describe('Stream maxConcurrency and TaskProducer', () => {
    it('should respect maxConcurrency limit', async () => {
        const activeTasks: number[] = []
        const maxConcurrency = 2
        const maxActiveTasks: number[] = []

        function* task(index: number) {
            activeTasks.push(index)
            maxActiveTasks.push(activeTasks.length)
            try {
                yield* Eff.await(delayTime(50))
                return `task-${index}`
            } finally {
                const taskIndex = activeTasks.indexOf(index)
                if (taskIndex > -1) {
                    activeTasks.splice(taskIndex, 1)
                }
            }
        }

        // Use TaskProducer function
        const producer = (index: number) => {
            if (index < 4) {
                return task(index)
            }
            return undefined // Early termination
        }

        const handler = async (stream: StreamResults<string>) => {
            const results = []
            for await (const { value } of stream) {
                results.push(value)
            }
            return results
        }

        const result = await Eff.run(Eff.stream(producer, handler, { maxConcurrency }))

        expect(result).toEqual(['task-0', 'task-1', 'task-2', 'task-3'])
        // Verify that active task count never exceeds max concurrency limit
        expect(Math.max(...maxActiveTasks)).toBeLessThanOrEqual(maxConcurrency)
        // Verify all tasks have completed
        expect(activeTasks.length).toBe(0)
    })

    it('should handle TaskProducer with early termination', async () => {
        let callCount = 0

        const producer = (index: number) => {
            callCount++
            if (index < 3) {
                return function* () {
                    yield* Eff.await(delayTime(10))
                    return `item-${index}`
                }
            }
            return undefined // Early termination
        }

        const handler = async (stream: StreamResults<string>) => {
            const results = []
            for await (const { value } of stream) {
                results.push(value)
            }
            return results
        }

        const result = await Eff.run(Eff.stream(producer, handler, { maxConcurrency: 2 }))

        expect(result).toEqual(['item-0', 'item-1', 'item-2'])
        expect(callCount).toBe(4) // 4th call returns undefined
    })

    it('should handle empty TaskProducer', async () => {
        const producer = (index: number) => {
            return undefined // Immediate termination
        }

        const handler = async (stream: StreamResults<string>) => {
            const results = []
            for await (const { value } of stream) {
                results.push(value)
            }
            return results
        }

        const result = await Eff.run(Eff.stream(producer, handler))

        expect(result).toEqual([])
    })

    it('should handle TaskProducer with conditional task generation', async () => {
        const producer = (index: number) => {
            if (index % 2 === 0) {
                return function* () {
                    yield* Eff.await(delayTime(10))
                    return `even-${index}`
                }
            } else if (index < 5) {
                return function* () {
                    yield* Eff.await(delayTime(5))
                    return `odd-${index}`
                }
            }
            return undefined
        }

        const handler = async (stream: StreamResults<string>) => {
            const results = [] as string[]
            for await (const { index, value } of stream) {
                results[index] = value
            }
            return results
        }

        const result = await Eff.run(Eff.stream(producer, handler, { maxConcurrency: 3 }))

        expect(result).toEqual(['even-0', 'odd-1', 'even-2', 'odd-3', 'even-4'])
    })
})

describe('All maxConcurrency and TaskProducer', () => {
    it('should respect maxConcurrency in all function', async () => {
        const activeTasks: number[] = []
        const maxConcurrency = 2
        const maxActiveTasks: number[] = []

        function* task(index: number) {
            activeTasks.push(index)
            maxActiveTasks.push(activeTasks.length)
            try {
                yield* Eff.await(delayTime(30))
                return `task-${index}`
            } finally {
                const taskIndex = activeTasks.indexOf(index)
                if (taskIndex > -1) {
                    activeTasks.splice(taskIndex, 1)
                }
            }
        }

        const producer = (index: number) => {
            if (index < 4) {
                return task(index)
            }
            return undefined
        }

        const result = await Eff.run(Eff.all(producer, { maxConcurrency }))

        expect(result).toEqual(['task-0', 'task-1', 'task-2', 'task-3'])
        // Verify that active task count never exceeds max concurrency limit
        expect(Math.max(...maxActiveTasks)).toBeLessThanOrEqual(maxConcurrency)
        expect(activeTasks.length).toBe(0)
    })

    it('should handle all with TaskProducer returning undefined', async () => {
        const producer = (index: number) => {
            if (index < 2) {
                return function* () {
                    yield* Eff.await(delayTime(10))
                    return `item-${index}`
                }
            }
            return undefined
        }

        const result = await Eff.run(Eff.all(producer))

        expect(result).toEqual(['item-0', 'item-1'])
    })

    it('should maintain order with maxConcurrency', async () => {
        const producer = (index: number) => {
            if (index < 3) {
                return function* () {
                    // Simulate different delays, but results should maintain index order
                    yield* Eff.await(delayTime((3 - index) * 10))
                    return `item-${index}`
                }
            }
            return undefined
        }

        const result = await Eff.run(Eff.all(producer, { maxConcurrency: 2 }))

        expect(result).toEqual(['item-0', 'item-1', 'item-2'])
    })
})

describe('Race maxConcurrency and TaskProducer', () => {
    it('should respect maxConcurrency in race function', async () => {
        const activeTasks: number[] = []
        const maxConcurrency = 2
        const maxActiveTasks: number[] = []

        function* task(index: number) {
            activeTasks.push(index)
            maxActiveTasks.push(activeTasks.length)
            try {
                yield* Eff.await(delayTime((index + 1) * 20))
                return `task-${index}`
            } finally {
                const taskIndex = activeTasks.indexOf(index)
                if (taskIndex > -1) {
                    activeTasks.splice(taskIndex, 1)
                }
            }
        }

        const producer = (index: number) => {
            if (index < 3) {
                return task(index)
            }
            return undefined
        }

        const result = await Eff.run(Eff.race(producer, { maxConcurrency }))

        // Should return the fastest task (task-0, 20ms delay)
        expect(result).toBe('task-0')
        // Verify that active task count never exceeds max concurrency limit
        expect(Math.max(...maxActiveTasks)).toBeLessThanOrEqual(maxConcurrency)
        expect(activeTasks.length).toBe(0)
    })

    it('should handle race with TaskProducer returning undefined', async () => {
        const producer = (index: number) => {
            if (index === 0) {
                return function* () {
                    yield* Eff.await(delayTime(10))
                    return 'fast'
                }
            }
            return undefined
        }

        const result = await Eff.run(Eff.race(producer))

        expect(result).toBe('fast')
    })

    it('should handle race with mixed fast and slow tasks', async () => {
        const producer = (index: number) => {
            if (index < 3) {
                return function* () {
                    if (index === 1) {
                        // Fastest task
                        return 'fastest'
                    } else {
                        yield* Eff.await(delayTime(50))
                        return `slow-${index}`
                    }
                }
            }
            return undefined
        }

        const result = await Eff.run(Eff.race(producer, { maxConcurrency: 2 }))

        expect(result).toBe('fastest')
    })
})

describe('Edge cases for maxConcurrency', () => {
    it('should throw error for invalid maxConcurrency', async () => {
        const producer = (index: number) => {
            if (index < 2) {
                return function* () {
                    return `item-${index}`
                }
            }
            return undefined
        }

        const handler = async (stream: StreamResults<string>) => {
            const results = []
            for await (const { value } of stream) {
                results.push(value)
            }
            return results
        }

        // Test maxConcurrency = 0
        expect(() => Eff.run(Eff.stream(producer, handler, { maxConcurrency: 0 }))).toThrow(
            'maxConcurrency must be greater than 0',
        )

        // Test maxConcurrency = -1
        expect(() => Eff.run(Eff.stream(producer, handler, { maxConcurrency: -1 }))).toThrow(
            'maxConcurrency must be greater than 0',
        )
    })

    it('should handle maxConcurrency = 1 (sequential execution)', async () => {
        const executionOrder: number[] = []
        const activeTasks: number[] = []
        const maxActiveTasks: number[] = []

        const producer = (index: number) => {
            if (index < 3) {
                return function* () {
                    activeTasks.push(index)
                    maxActiveTasks.push(activeTasks.length)
                    executionOrder.push(index)
                    try {
                        yield* Eff.await(delayTime(10))
                        return `item-${index}`
                    } finally {
                        const taskIndex = activeTasks.indexOf(index)
                        if (taskIndex > -1) {
                            activeTasks.splice(taskIndex, 1)
                        }
                    }
                }
            }
            return undefined
        }

        const handler = async (stream: StreamResults<string>) => {
            const results = []
            for await (const { value } of stream) {
                results.push(value)
            }
            return results
        }

        const result = await Eff.run(Eff.stream(producer, handler, { maxConcurrency: 1 }))

        expect(result).toEqual(['item-0', 'item-1', 'item-2'])
        // Verify that max concurrency is indeed 1
        expect(Math.max(...maxActiveTasks)).toBe(1)
        // Execution order should be 0, 1, 2 (sequential execution)
        expect(executionOrder).toEqual([0, 1, 2])
        expect(activeTasks.length).toBe(0)
    })

    it('should handle large maxConcurrency value', async () => {
        const activeTasks: number[] = []
        const maxActiveTasks: number[] = []

        const producer = (index: number) => {
            if (index < 5) {
                return function* () {
                    activeTasks.push(index)
                    maxActiveTasks.push(activeTasks.length)
                    try {
                        yield* Eff.await(delayTime(10))
                        return `item-${index}`
                    } finally {
                        const taskIndex = activeTasks.indexOf(index)
                        if (taskIndex > -1) {
                            activeTasks.splice(taskIndex, 1)
                        }
                    }
                }
            }
            return undefined
        }

        const handler = async (stream: StreamResults<string>) => {
            const results = []
            for await (const { value } of stream) {
                results.push(value)
            }
            return results
        }

        const result = await Eff.run(Eff.stream(producer, handler, { maxConcurrency: 1000 }))

        expect(result).toEqual(['item-0', 'item-1', 'item-2', 'item-3', 'item-4'])
        // Verify all tasks can execute concurrently (max active tasks should equal total tasks)
        expect(Math.max(...maxActiveTasks)).toBe(5)
        expect(activeTasks.length).toBe(0)
    })
})

describe('TaskProducer with error handling', () => {
    it('should handle errors in TaskProducer', async () => {
        class ProducerError extends Eff.Err('ProducerError')<string> {}

        const producer: Eff.TaskProducer<ProducerError | Async, string> = (index: number) => {
            if (index === 1) {
                return function* () {
                    yield* Eff.throw(new ProducerError('Producer failed'))
                    return 'should not reach here'
                }
            } else if (index < 3) {
                return function* () {
                    yield* Eff.await(delayTime(10))
                    return `item-${index}`
                }
            }
            return undefined
        }

        const handler = async (stream: StreamResults<string>) => {
            const results = []
            try {
                for await (const { value } of stream) {
                    results.push(value)
                }
            } catch (error) {
                if (error instanceof ProducerError) {
                    return `Error: ${error.error}`
                }
                throw error
            }
            return results
        }

        const result = await Eff.runAsync(
            Eff.try(Eff.stream(producer, handler, { maxConcurrency: 2 })).handle({
                ProducerError: (error) => `Error: ${error}`,
            }),
        )

        expect(result).toBe('Error: Producer failed')
    })

    it('should verify maxConcurrency with semaphore-like tracking', async () => {
        const maxConcurrency = 3
        const activeCount = { value: 0 }
        const maxActiveCount = { value: 0 }
        const taskStartTimes: number[] = []
        const taskEndTimes: number[] = []

        const producer = (index: number) => {
            if (index < 5) {
                return function* () {
                    // Record task start
                    activeCount.value++
                    maxActiveCount.value = Math.max(maxActiveCount.value, activeCount.value)
                    taskStartTimes[index] = Date.now()

                    try {
                        // Simulate workload
                        yield* Eff.await(delayTime(20))
                        return `task-${index}`
                    } finally {
                        // Record task end
                        activeCount.value--
                        taskEndTimes[index] = Date.now()
                    }
                }
            }
            return undefined
        }

        const handler = async (stream: StreamResults<string>) => {
            const results = []
            for await (const { value } of stream) {
                results.push(value)
            }
            return results
        }

        const result = await Eff.run(Eff.stream(producer, handler, { maxConcurrency }))

        expect(result).toEqual(['task-0', 'task-1', 'task-2', 'task-3', 'task-4'])

        // Verify that max concurrency never exceeds the limit
        expect(maxActiveCount.value).toBeLessThanOrEqual(maxConcurrency)

        // Verify all tasks have completed
        expect(activeCount.value).toBe(0)

        // Verify tasks are truly executing concurrently (at least some tasks have overlapping time)
        const hasOverlap = taskStartTimes.some((startTime, i) => {
            if (i === 0) return false
            // Check if any task starts before another task ends
            return taskStartTimes
                .slice(0, i)
                .some((prevStart) => startTime < taskEndTimes[taskStartTimes.indexOf(prevStart)])
        })
        expect(hasOverlap).toBe(true)
    })

    it('should handle TaskProducer returning function vs generator', async () => {
        const producer = (index: number) => {
            if (index === 0) {
                // Return function
                return function* () {
                    return 'function'
                }
            } else if (index === 1) {
                // Return generator instance
                return (function* () {
                    return 'generator'
                })()
            }
            return undefined
        }

        const handler = async (stream: StreamResults<string>) => {
            const results = []
            for await (const { value } of stream) {
                results.push(value)
            }
            return results
        }

        const result = await Eff.run(Eff.stream(producer, handler))

        expect(result).toEqual(['function', 'generator'])
    })
})
