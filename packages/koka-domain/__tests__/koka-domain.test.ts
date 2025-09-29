import * as Async from 'koka/async'
import * as Result from 'koka/result'
import {
    Domain,
    Store,
    Event,
    event,
    command,
    get,
    getState,
    emit,
    query,
    set,
    setState,
    shallowEqualResult,
    subscribeDomainResult,
    subscribeDomainState,
    subscribeQueryResult,
    subscribeQueryState,
    CommandExecutionTree,
} from '../src/koka-domain.ts'
import { PrettyLogger } from '../src/pretty-cli-logger.ts'

type Todo = {
    id: number
    text: string
    done: boolean
}

type TodoApp = {
    todos: Todo[]
    filter: 'all' | 'done' | 'undone'
    input: string
}

class TextDomain<Root> extends Domain<string, Root> {
    @command()
    *updateText(text: string) {
        yield* set(this, text)
        return 'text updated'
    }
    @command()
    *clearText() {
        yield* set(this, '')
        return 'text cleared'
    }
}

class BoolDomain<Root> extends Domain<boolean, Root> {
    @command()
    *toggle() {
        yield* set(this, (value) => !value)
        return 'bool toggled'
    }
}

class RemoveTodoEvent extends Event('RemoveTodo')<{ todoId: number }> {}

class TodoDomain<Root> extends Domain<Todo, Root> {
    text$ = new TextDomain(this.prop('text'))
    done$ = new BoolDomain(this.prop('done'));

    @command()
    *updateTodoText(text: string) {
        const done = yield* get(this.done$)
        yield* this.text$.updateText(text)
        return 'todo updated'
    }

    @command()
    *toggleTodo() {
        yield* this.done$.toggle()
        return 'todo toggled'
    }

    @command()
    *removeTodo() {
        const todo = yield* get(this)
        yield* emit(this, new RemoveTodoEvent({ todoId: todo.id }))
        return 'todo removed'
    }
}

let todoUid = 0

const test = event(RemoveTodoEvent)

class TodoListDomain<Root> extends Domain<Todo[], Root> {
    @command()
    *removeTodo(id: number) {
        yield* set(this, (todos) => todos.filter((todo) => todo.id !== id))
        return 'todo removed'
    }

    @event(RemoveTodoEvent)
    *handleRemoveTodo(event: RemoveTodoEvent) {
        yield* this.removeTodo(event.payload.todoId)
    }

    @command()
    *addTodo(text: string) {
        const newTodo = {
            id: todoUid++,
            text,
            done: false,
        }
        yield* set(this, (todos) => [...todos, newTodo])

        return 'todo added'
    }

    todo(id: number) {
        return new TodoDomain(this.find((todo) => todo.id === id))
    }

    getKey = (todo: Todo) => {
        return todo.id
    }

    completedTodoList$ = this.filter((todo) => todo.done)
    completedTodoTextList$ = this.completedTodoList$.map((todo$) => todo$.prop('text'));

    @query()
    *getCompletedTodoList() {
        const completedTodoList = yield* get(this.completedTodoList$)
        return completedTodoList
    }

    activeTodoList$ = this.filter((todo) => !todo.done)
    activeTodoTextList$ = this.activeTodoList$.map((todo$) => todo$.prop('text'));

    @query()
    *getActiveTodoList() {
        const activeTodoList = yield* get(this.activeTodoList$)
        return activeTodoList
    }

    length$ = this.prop('length');

    @query()
    *getTodoCount() {
        const todoCount = yield* get(this.length$)
        return todoCount
    }
}

class TodoAppDomain<Root> extends Domain<TodoApp, Root> {
    todos$ = new TodoListDomain(this.prop('todos'))
    input$ = new TextDomain(this.prop('input'))
    filter$ = this.prop('filter');

    @command()
    *addTodo() {
        const todoApp = yield* get(this)
        yield* this.todos$.addTodo(todoApp.input)
        yield* this.updateInput('')
        return 'Todo added'
    }

    @command()
    *updateInput(input: string) {
        yield* Async.await(Promise.resolve('test async'))
        yield* this.input$.updateText(input)
        return 'Input updated'
    }

    @query()
    *getFilteredTodoList() {
        const filter = yield* get(this.filter$)
        const todos = yield* get(this.todos$)

        if (filter === 'all') {
            return todos
        } else if (filter === 'done') {
            return todos.filter((todo) => todo.done)
        } else {
            return todos.filter((todo) => !todo.done)
        }
    }

    @query()
    *getTodoSummary() {
        const activeTodoCount = yield* get(this.todos$.activeTodoList$.prop('length'))
        const completedTodoCount = yield* get(this.todos$.completedTodoList$.prop('length'))
        const filter = yield* get(this.filter$)
        return {
            activeTodoCount,
            completedTodoCount,
            filter,
        }
    }

    @query()
    *errorQuery() {
        yield* get(this.todos$.index(-1))
    }
}

// Create a query that throws an error
class ErrorQueryDomain extends Domain<TodoApp, TodoApp> {
    @query()
    *errorQuery() {
        const result = yield* get(this.prop('filter').match((state) => state === 'done'))
        return result
    }
}

describe('TodoAppDomain', () => {
    let store: Store<TodoApp>
    let todoApp$: TodoAppDomain<TodoApp>

    beforeEach(() => {
        todoUid = 0
        store = new Store<TodoApp>({
            state: {
                todos: [],
                filter: 'all',
                input: '',
            },
        })

        todoApp$ = new TodoAppDomain(store.domain)
    })

    it('should initialize with empty state', () => {
        const state = store.getState()
        expect(state.todos).toEqual([])
        expect(state.filter).toBe('all')
        expect(state.input).toBe('')
    })

    it('should add todo', async () => {
        const result0 = await Result.run(todoApp$.updateInput('Test todo'))
        const result1 = await Result.run(todoApp$.addTodo())

        const state = store.getState()

        expect(state.todos.length).toBe(1)
        expect(state.todos[0].text).toBe('Test todo')
        expect(state.todos[0].done).toBe(false)
    })

    it('should clear input after adding todo', async () => {
        await Result.run(todoApp$.updateInput('Test todo'))
        await Result.run(todoApp$.addTodo())

        const state = store.getState()
        expect(state.input).toBe('')
    })

    it('should update todo text', async () => {
        await Result.run(todoApp$.updateInput('Todo 1'))
        await Result.run(todoApp$.addTodo())
        await Result.run(todoApp$.updateInput('Todo 2'))
        await Result.run(todoApp$.addTodo())

        const todoId = store.getState().todos[0].id
        Result.run(todoApp$.todos$.todo(todoId).updateTodoText('Updated text'))

        const state = store.getState()
        expect(state.todos[0].text).toBe('Updated text')
    })

    it('should toggle todo status', async () => {
        await Result.run(todoApp$.updateInput('Todo 1'))
        await Result.run(todoApp$.addTodo())
        await Result.run(todoApp$.updateInput('Todo 2'))
        await Result.run(todoApp$.addTodo())

        const todoId = store.getState().todos[0].id
        Result.run(todoApp$.todos$.todo(todoId).toggleTodo())

        const state = store.getState()
        expect(state.todos[0].done).toBe(true)
    })

    it('should filter active todos', async () => {
        await Result.run(todoApp$.updateInput('Active 1'))
        await Result.run(todoApp$.addTodo())
        await Result.run(todoApp$.updateInput('Active 2'))
        await Result.run(todoApp$.addTodo())
        await Result.run(todoApp$.updateInput('Completed 1'))
        await Result.run(todoApp$.addTodo())

        const todoId = store.getState().todos[2].id
        Result.run(todoApp$.todos$.todo(todoId).toggleTodo())

        const result = getState(todoApp$.todos$.activeTodoList$)

        if (result.type === 'err') {
            throw new Error('Expected todos but got error')
        }

        expect(result.value.length).toBe(2)
        expect(result.value.every((todo: Todo) => !todo.done)).toBe(true)
    })

    it('should filter completed todos', async () => {
        await Result.run(todoApp$.updateInput('Active 1'))
        await Result.run(todoApp$.addTodo())
        await Result.run(todoApp$.updateInput('Active 2'))
        await Result.run(todoApp$.addTodo())
        await Result.run(todoApp$.updateInput('Completed 1'))
        await Result.run(todoApp$.addTodo())

        const todoId = store.getState().todos[2].id
        Result.run(todoApp$.todos$.todo(todoId).toggleTodo())

        const result = getState(todoApp$.todos$.completedTodoList$)

        if (result.type === 'err') {
            throw new Error('Expected todos but got error')
        }

        expect(result.value.length).toBe(1)
        expect(result.value.every((todo: Todo) => todo.done)).toBe(true)
    })

    it('should get active todo texts', async () => {
        await Result.run(todoApp$.updateInput('Active 1'))
        await Result.run(todoApp$.addTodo())
        await Result.run(todoApp$.updateInput('Active 2'))
        await Result.run(todoApp$.addTodo())
        await Result.run(todoApp$.updateInput('Completed 1'))
        await Result.run(todoApp$.addTodo())

        const todoId = store.getState().todos[2].id
        Result.run(todoApp$.todos$.todo(todoId).toggleTodo())

        const result = getState(todoApp$.todos$.activeTodoTextList$)

        if (result.type === 'err') {
            throw new Error('Expected texts but got error')
        }

        expect(result.value).toEqual(['Active 1', 'Active 2'])
    })

    it('should get completed todo texts', async () => {
        await Result.run(todoApp$.updateInput('Active 1'))
        await Result.run(todoApp$.addTodo())
        await Result.run(todoApp$.updateInput('Active 2'))
        await Result.run(todoApp$.addTodo())
        await Result.run(todoApp$.updateInput('Completed 1'))
        await Result.run(todoApp$.addTodo())

        const todoId = store.getState().todos[2].id
        Result.run(todoApp$.todos$.todo(todoId).toggleTodo())

        const result = getState(todoApp$.todos$.completedTodoTextList$)

        if (result.type === 'err') {
            throw new Error('Expected texts but got error')
        }

        expect(result.value).toEqual(['Completed 1'])
    })

    it('should handle async input update', async () => {
        const result = await Result.run(todoApp$.updateInput('Async test'))

        if (result.type === 'err') {
            throw new Error('Expected success but got error')
        }

        expect(result.value).toBe('Input updated')

        const state = store.getState()

        expect(state.input).toBe('Async test')
    })
})

describe('Store', () => {
    let store: Store<TodoApp>

    beforeEach(() => {
        todoUid = 0
        store = new Store<TodoApp>({
            state: {
                todos: [],
                filter: 'all',
                input: '',
            },
        })
    })

    it('should get initial state', () => {
        const state = store.getState()
        expect(state).toEqual({
            todos: [],
            filter: 'all',
            input: '',
        })
    })

    it('should set state and increment version', () => {
        const newState = {
            todos: [{ id: 1, text: 'test', done: false }],
            filter: 'all' as const,
            input: 'test',
        }

        store.setState(newState)

        expect(store.getState()).toEqual(newState)
        expect(store.version).toBe(1)
    })

    it('should not update state if shallow equal', () => {
        const initialState = store.getState()
        const initialVersion = store.version

        store.setState(initialState)

        expect(store.getState()).toBe(initialState)
        expect(store.version).toBe(initialVersion)
    })

    it('should subscribe to state changes', async () => {
        const listener = jest.fn()
        const unsubscribe = store.subscribe(listener)

        const newState = { ...store.getState(), input: 'test' }
        store.setState(newState)

        await store.promise

        expect(listener).toHaveBeenCalledWith(newState)
        unsubscribe()
    })

    it('should unsubscribe from state changes', async () => {
        const listener = jest.fn()
        const unsubscribe = store.subscribe(listener)

        unsubscribe()

        const newState = { ...store.getState(), input: 'test' }
        store.setState(newState)

        await store.promise

        expect(listener).not.toHaveBeenCalled()
    })

    it('should destroy store and clear listeners', async () => {
        const listener = jest.fn()
        store.subscribe(listener)

        store.destroy()

        store.setState({ ...store.getState(), input: 'test' })
        await store.promise

        expect(listener).not.toHaveBeenCalled()
    })

    it('should subscribe to execution events', async () => {
        const listener = jest.fn()
        const unsubscribe = store.subscribeExecution(listener)

        const executionTree = {
            type: 'command' as const,
            domainName: 'test',
            name: 'test',
            async: false,
            args: [],
            states: [],
            changes: [],
            commands: [],
            queries: [],
            events: [],
        } satisfies CommandExecutionTree

        store.publishExecution(executionTree)

        await store.promise

        expect(listener).toHaveBeenCalledWith(executionTree)
        unsubscribe()
    })

    it('should apply enhancers', () => {
        const enhancer = jest.fn().mockReturnValue(() => {})
        const store = new Store<TodoApp>({
            state: {
                todos: [],
                filter: 'all',
                input: '',
            },
            plugins: [enhancer],
        })

        expect(enhancer).toHaveBeenCalledWith(store)
    })

    it('should handle enhancer cleanup', () => {
        const cleanup = jest.fn()
        const enhancer = jest.fn().mockReturnValue(cleanup)
        const store = new Store<TodoApp>({
            state: {
                todos: [],
                filter: 'all',
                input: '',
            },
            plugins: [enhancer],
        })

        // Cleanup should be stored but not called yet
        expect(cleanup).not.toHaveBeenCalled()

        store.destroy()

        expect(cleanup).toHaveBeenCalled()
    })
})

describe('Domain', () => {
    let store: Store<TodoApp>
    let domain: Domain<TodoApp, TodoApp>

    beforeEach(() => {
        todoUid = 4
        store = new Store<TodoApp>({
            state: {
                todos: [
                    { id: 1, text: 'test', done: false },
                    { id: 2, text: 'test2', done: true },
                    { id: 3, text: 'test3', done: false },
                ],
                filter: 'all',
                input: 'initial input',
            },
        })
        domain = store.domain
    })

    it('should transform domain', () => {
        const transformed = domain.transform({
            get: (state: TodoApp) => state.todos,
            set: (todos: Todo[], state: TodoApp) => ({ ...state, todos }),
        })
        expect(transformed).toBeInstanceOf(Domain)

        const result = getState(transformed)
        expect(result).toEqual(
            Result.ok([
                { id: 1, text: 'test', done: false },
                { id: 2, text: 'test2', done: true },
                { id: 3, text: 'test3', done: false },
            ]),
        )
    })

    it('should access property', () => {
        const inputDomain = domain.prop('input')
        expect(inputDomain).toBeInstanceOf(Domain)

        const result = getState(inputDomain)
        expect(result).toEqual(Result.ok('initial input'))
    })

    it('should access array index', () => {
        const todosDomain = domain.prop('todos')
        const firstTodoDomain = todosDomain.index(0)
        expect(firstTodoDomain).toBeInstanceOf(Domain)

        const result = getState(firstTodoDomain)
        expect(result).toEqual(Result.ok({ id: 1, text: 'test', done: false }))
    })

    it('should find array item', () => {
        const todosDomain = domain.prop('todos')
        const todoDomain = todosDomain.find((todo) => todo.id === 1)
        expect(todoDomain).toBeInstanceOf(Domain)

        const result = getState(todoDomain)
        expect(result).toEqual(Result.ok({ id: 1, text: 'test', done: false }))
    })

    it('should match state', () => {
        const matchedDomain = domain.prop('filter').match((state): state is 'all' => state === 'all')
        expect(matchedDomain).toBeInstanceOf(Domain)

        const result = getState(matchedDomain)
        expect(result).toEqual(Result.ok('all'))

        const unmatchedDomain = domain.prop('filter').match((state): state is 'done' => state === 'done')
        expect(unmatchedDomain).toBeInstanceOf(Domain)

        const unmatchedResult = getState(unmatchedDomain)
        expect(unmatchedResult.type).toEqual('err')
    })

    it('should refine state', () => {
        const refinedDomain = domain.refine((state) => state.todos.length > 0)
        expect(refinedDomain).toBeInstanceOf(Domain)

        const result = getState(refinedDomain)
        expect(result).toEqual(Result.ok(store.getState()))

        const failedRefinedDomain = domain.refine((state) => state.todos.length === 0)
        expect(failedRefinedDomain).toBeInstanceOf(Domain)

        const failedResult = getState(failedRefinedDomain)
        expect(failedResult.type).toEqual('err')
    })

    it('should map array', () => {
        const todosDomain = domain.prop('todos')
        const mappedDomain = todosDomain.map((todo$) => todo$.prop('text'))
        expect(mappedDomain).toBeInstanceOf(Domain)

        const result = getState(mappedDomain)
        expect(result).toEqual(Result.ok(['test', 'test2', 'test3']))
    })

    it('should filter array', () => {
        const todosDomain = domain.prop('todos')
        const filteredDomain = todosDomain.filter((todo) => todo.done)
        expect(filteredDomain).toBeInstanceOf(Domain)

        const result = getState(filteredDomain)

        expect(result).toEqual(Result.ok([{ id: 2, text: 'test2', done: true }]))
    })

    it('should select with proxy', () => {
        const selectedDomain = domain.select((proxy) => proxy.filter)
        expect(selectedDomain).toBeInstanceOf(Domain)

        const result = getState(selectedDomain)
        expect(result).toEqual(Result.ok('all'))
    })
})

describe('Cache mechanism', () => {
    let store: Store<TodoApp>
    let todoApp$: TodoAppDomain<TodoApp>

    beforeEach(() => {
        todoUid = 4
        store = new Store<TodoApp>({
            state: {
                todos: [
                    { id: 1, text: 'test', done: false },
                    { id: 2, text: 'test2', done: true },
                    { id: 3, text: 'test3', done: false },
                ],
                filter: 'all',
                input: 'initial input',
            },
        })
        todoApp$ = new TodoAppDomain(store.domain)
    })

    it('should cache domain state results', async () => {
        const result1 = getState(todoApp$.todos$)
        expect(result1).toEqual(
            Result.ok([
                { id: 1, text: 'test', done: false },
                { id: 2, text: 'test2', done: true },
                { id: 3, text: 'test3', done: false },
            ]),
        )

        const result2 = getState(todoApp$.todos$)
        expect(shallowEqualResult(result1, result2)).toBe(true)
    })

    it('should invalidate cache when store version changes', () => {
        const result1 = getState(todoApp$.todos$)

        const unchangedTodo$ = todoApp$.todos$.todo(2)
        const willChangedTodo$ = todoApp$.todos$.todo(1)

        const result3 = getState(unchangedTodo$)
        const result4 = getState(willChangedTodo$)

        Result.run(willChangedTodo$.toggleTodo())

        const result5 = getState(unchangedTodo$)
        const result6 = getState(willChangedTodo$)
        const result7 = getState(todoApp$.todos$)

        expect(shallowEqualResult(result3, result5)).toBe(true)
        expect(shallowEqualResult(result4, result6)).toBe(false)
        expect(shallowEqualResult(result1, result7)).toBe(false)
    })

    it('should cache nested domain results', async () => {
        const todoId = store.getState().todos[0].id
        const todoDomain = todoApp$.todos$.todo(todoId)

        const result1 = getState(todoDomain)
        expect(result1).toEqual(Result.ok({ id: 1, text: 'test', done: false }))

        const result2 = getState(todoDomain)
        expect(shallowEqualResult(result1, result2)).toBe(true)
    })

    it('should cache query results', async () => {
        const result1 = Result.run(todoApp$.getTodoSummary())

        expect(result1).toEqual(
            Result.ok({
                activeTodoCount: 2,
                completedTodoCount: 1,
                filter: 'all',
            }),
        )

        const result2 = Result.run(todoApp$.getTodoSummary())
        expect(shallowEqualResult(result1, result2)).toBe(true)
    })

    it('should invalidate query cache when dependencies change', async () => {
        const result1 = Result.run(todoApp$.getTodoSummary())
        const todo$ = todoApp$.todos$.todo(1)

        const result2 = getState(todo$)

        expect(result1).toEqual(
            Result.ok({
                activeTodoCount: 2,
                completedTodoCount: 1,
                filter: 'all',
            }),
        )

        expect(result2).toEqual(Result.ok({ id: 1, text: 'test', done: false }))

        const result3 = Result.run(todoApp$.getTodoSummary())
        const result4 = getState(todo$)

        expect(shallowEqualResult(result1, result3)).toBe(true)
        expect(shallowEqualResult(result2, result4)).toBe(true)

        Result.run(todoApp$.todos$.todo(1).updateTodoText('test4'))

        const result5 = getState(todo$)
        const result6 = Result.run(todoApp$.getTodoSummary())

        expect(shallowEqualResult(result2, result5)).toBe(false)
        expect(shallowEqualResult(result1, result6)).toBe(true)
    })
})

describe('Query functionality', () => {
    let store: Store<TodoApp>
    let todoApp$: TodoAppDomain<TodoApp>

    beforeEach(() => {
        todoUid = 4
        store = new Store<TodoApp>({
            state: {
                todos: [
                    { id: 1, text: 'todo 1', done: false },
                    { id: 2, text: 'todo 2', done: true },
                    { id: 3, text: 'todo 3', done: false },
                ],
                filter: 'all',
                input: '',
            },
        })
        todoApp$ = new TodoAppDomain(store.domain)
    })

    it('should execute query and return filtered todos', async () => {
        const result1 = Result.run(todoApp$.getFilteredTodoList())

        expect(result1).toEqual(
            Result.ok([
                { id: 1, text: 'todo 1', done: false },
                { id: 2, text: 'todo 2', done: true },
                { id: 3, text: 'todo 3', done: false },
            ]),
        )

        const result2 = Result.run(todoApp$.getFilteredTodoList())
        expect(shallowEqualResult(result1, result2)).toBe(true)

        setState(todoApp$.filter$, 'done')

        const result3 = Result.run(todoApp$.getFilteredTodoList())
        expect(shallowEqualResult(result1, result3)).toBe(false)

        const result4 = Result.run(todoApp$.getFilteredTodoList())
        expect(shallowEqualResult(result3, result4)).toBe(true)

        expect(result4).toEqual(Result.ok([{ id: 2, text: 'todo 2', done: true }]))
    })

    it('should filter todos by done status', async () => {
        setState(todoApp$.filter$, 'done')

        const result = Result.run(todoApp$.getFilteredTodoList())
        expect(result).toEqual(Result.ok([store.getState().todos[1]]))
    })

    it('should filter todos by undone status', async () => {
        // Set filter to undone
        setState(todoApp$.filter$, 'undone')

        const result = Result.run(todoApp$.getFilteredTodoList())
        expect(result).toEqual(Result.ok(store.getState().todos.filter((todo) => !todo.done)))
    })

    it('should cache query results', async () => {
        // First call
        const result1 = Result.run(todoApp$.getFilteredTodoList())
        expect(result1.type).toBe('ok')

        // Second call should return cached result
        const result2 = Result.run(todoApp$.getFilteredTodoList())
        expect(shallowEqualResult(result2, result1)).toBe(true)
    })

    it('should invalidate cache when dependencies change', () => {
        // First call
        const result1 = Result.run(todoApp$.getFilteredTodoList())
        expect(result1.type).toBe('ok')

        // Change filter
        setState(todoApp$.filter$, 'done')

        // Second call should return new result
        const result2 = Result.run(todoApp$.getFilteredTodoList())
        expect(shallowEqualResult(result2, result1)).toBe(false)
        expect(result2).toEqual(Result.ok([store.getState().todos[1]]))
    })

    it('should invalidate cache when todos change', async () => {
        // First call
        const result1 = Result.run(todoApp$.getFilteredTodoList())
        expect(result1.type).toBe('ok')

        // Add a new todo
        await Result.run(todoApp$.updateInput('new todo'))
        await Result.run(todoApp$.addTodo())

        // Second call should return new result
        const result2 = Result.run(todoApp$.getFilteredTodoList())

        expect(result2).toEqual(
            Result.ok([
                { id: 1, text: 'todo 1', done: false },
                { id: 2, text: 'todo 2', done: true },
                { id: 3, text: 'todo 3', done: false },
                { id: 4, text: 'new todo', done: false },
            ]),
        )

        expect(shallowEqualResult(result2, result1)).toBe(false)
    })

    it('should handle errors in query execution', () => {
        const errorDomain = new ErrorQueryDomain(store.domain)

        const result = Result.run(errorDomain.errorQuery())
        expect(result.type).toBe('err')
    })
})

describe('Subscription mechanisms', () => {
    let store: Store<TodoApp>
    let todoApp$: TodoAppDomain<TodoApp>

    beforeEach(() => {
        store = new Store<TodoApp>({
            state: {
                todos: [
                    { id: 1, text: 'todo 1', done: false },
                    { id: 2, text: 'todo 2', done: true },
                    { id: 3, text: 'todo 3', done: false },
                ],
                filter: 'all',
                input: '',
            },
        })
        todoApp$ = new TodoAppDomain(store.domain)
    })

    it('should subscribe to domain state changes', async () => {
        const listener = jest.fn()
        const unsubscribe = subscribeDomainState(todoApp$.input$, listener)

        await Result.run(todoApp$.updateInput('new input'))

        await store.promise

        expect(listener).toHaveBeenCalledWith('new input')
        unsubscribe()

        await Result.run(todoApp$.updateInput('new input 2'))

        await store.promise

        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should subscribe to domain result changes', async () => {
        const listener = jest.fn()
        const unsubscribe = subscribeDomainResult(todoApp$.input$, listener)

        await Result.run(todoApp$.updateInput('new input'))

        await store.promise

        expect(listener).toHaveBeenCalledWith(expect.objectContaining(Result.ok('new input')))
        unsubscribe()
    })

    it('should not trigger subscription for equal results', async () => {
        const listener = jest.fn()
        const unsubscribe = subscribeDomainResult(todoApp$.input$, listener)

        // Set the same value
        await Result.run(todoApp$.updateInput(''))
        await store.promise

        expect(listener).not.toHaveBeenCalled()

        setState(todoApp$.filter$, 'all')

        expect(listener).not.toHaveBeenCalled()

        unsubscribe()
    })

    it('should subscribe to query state changes', async () => {
        const listener = jest.fn()
        const unsubscribe = subscribeQueryState(todoApp$.getFilteredTodoList, listener)

        // Mark todo as done
        const todoId = store.getState().todos[0].id

        Result.run(todoApp$.todos$.todo(todoId).toggleTodo())
        setState(todoApp$.filter$, 'done')

        await store.promise

        expect(listener).toHaveBeenCalledWith([
            { id: 1, text: 'todo 1', done: true },
            { id: 2, text: 'todo 2', done: true },
        ])

        Result.run(todoApp$.todos$.todo(3).updateTodoText('test 3 updated'))

        await store.promise

        expect(listener).toHaveBeenCalledTimes(1)
        unsubscribe()
    })

    it('should subscribe to query result changes', async () => {
        const listener = jest.fn()
        const unsubscribe = subscribeQueryResult(todoApp$.getFilteredTodoList, listener)

        setState(todoApp$.filter$, 'undone')

        await store.promise

        expect(listener).toHaveBeenCalledWith(
            Result.ok([
                { id: 1, text: 'todo 1', done: false },
                { id: 3, text: 'todo 3', done: false },
            ]),
        )

        unsubscribe()
    })

    it('should handle query errors', async () => {
        const errorDomain = new ErrorQueryDomain(store.domain)
        const listener = jest.fn()
        const unsubscribe = subscribeQueryResult(errorDomain.errorQuery, listener)

        setState(errorDomain.prop('filter'), 'undone')

        await store.promise

        expect(listener).toHaveBeenCalledTimes(0)

        setState(errorDomain.prop('filter'), 'done')

        await store.promise

        expect(listener).toHaveBeenCalledWith(expect.objectContaining(Result.ok('done')))
        unsubscribe()
    })
})

describe('Event functionality', () => {
    let store: Store<TodoApp>
    let todoApp$: TodoAppDomain<TodoApp>

    beforeEach(() => {
        todoUid = 4
        store = new Store<TodoApp>({
            state: {
                todos: [
                    { id: 1, text: 'todo 1', done: false },
                    { id: 2, text: 'todo 2', done: true },
                    { id: 3, text: 'todo 3', done: false },
                ],
                filter: 'all',
                input: '',
            },
            plugins: [PrettyLogger()],
        })
        todoApp$ = new TodoAppDomain(store.domain)
    })

    it('should trigger event handler', async () => {
        Result.run(todoApp$.todos$.todo(1).removeTodo())

        await store.promise

        const state = store.getState()

        expect(state.todos).toEqual([
            { id: 2, text: 'todo 2', done: true },
            { id: 3, text: 'todo 3', done: false },
        ])
    })
})
