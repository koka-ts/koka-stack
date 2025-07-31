import * as Koka from '../src/koka'
import * as Err from '../src/err'
import * as Result from '../src/result'
import * as Async from '../src/async'

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

describe('Result.toErr', () => {
    it('test success', () => {
        function* success() {
            return Result.ok(42)
        }

        function* testSuccess() {
            const value = yield* Result.unwrap(success())
            return value
        }

        const result = Koka.run(testSuccess)

        expect(result).toBe(42)
    })

    it('test failure', () => {
        class TestError extends Err.Err('TestError')<string> {}

        function* testFailure() {
            yield* Result.unwrap(Result.wrap(Err.throw(new TestError('error'))))
        }

        const failureResult = Koka.run(
            Koka.try(testFailure).handle({
                TestError: (error) => `Caught: ${error}`,
            }),
        )

        expect(failureResult).toBe('Caught: error')
    })
})

describe('Result.run', () => {
    it('should run generator and return Result', async () => {
        class ZeroError extends Err.Err('ZeroError')<string> {}

        function* program(input: number) {
            const value = yield* Async.await(Promise.resolve(input))

            if (value === 0) {
                yield* Err.throw(new ZeroError('value is zero'))
            }

            return value
        }

        const result = await Result.run(program(42))

        expect(result).toEqual({
            type: 'ok',
            value: 42,
        })
    })

    it('should handle error in generator', () => {
        class TestError extends Err.Err('TestError')<string> {}

        function* program() {
            yield* Err.throw(new TestError('error message'))
            return 'should not reach here'
        }

        const result = Result.run(program)

        expect(result).toEqual({
            type: 'err',
            name: 'TestError',
            error: 'error message',
        })
    })
})
