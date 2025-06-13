import { Eff } from 'koka'
import { Store, Domain, get, set, query, command, Optic } from '../src/koka-ddd'

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

class TodoDomain<Root> extends Domain<Todo, Root> {
    text = new TextDomain(this.$.prop('text'))
    done = new BoolDomain(this.$.prop('done'));

    @command()
    *updateTodoText(text: string) {
        yield* this.text.updateText(text)
        return 'todo updated'
    }

    @command()
    *toggleTodo() {
        yield* this.done.toggle()
        return 'todo toggled'
    }
}

let todoUid = 0

class TodoListDomain<Root> extends Domain<Todo[], Root> {
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
        return new TodoDomain(this.$.find((todo) => todo.id === id))
    }

    getKey = (todo: Todo) => {
        return todo.id
    }

    completedTodoList = this.$.filter((todo) => todo.done)
    activeTodoList = this.$.filter((todo) => !todo.done)
    activeTodoTextList = this.activeTodoList.map((todo$) => todo$.prop('text'))
    completedTodoTextList = this.completedTodoList.map((todo$) => todo$.prop('text'))

    texts = Optic.object({
        completed: this.completedTodoTextList,
        active: this.activeTodoTextList,
    })
}

class TodoAppDomain<Root> extends Domain<TodoApp, Root> {
    todos = new TodoListDomain(this.$.prop('todos'))
    input = new TextDomain(this.$.prop('input'));

    @command()
    *addTodo() {
        const todoApp = yield* get(this)
        yield* this.todos.addTodo(todoApp.input)
        yield* this.updateInput('')
        return 'Todo added'
    }

    @command()
    *updateInput(input: string) {
        yield* Eff.await(Promise.resolve('test async'))
        yield* this.input.updateText(input)
        return 'Input updated'
    }
}

const todoApp$ = new TodoAppDomain(Optic.root<TodoApp>())

describe('TodoAppDomain', () => {
    let store: Store<TodoApp>

    beforeEach(() => {
        store = new Store<TodoApp>({
            state: {
                todos: [],
                filter: 'all',
                input: '',
            },
        })
    })

    describe('basic operations', () => {
        it('should initialize with empty state', () => {
            const state = store.getState()
            expect(state.todos).toEqual([])
            expect(state.filter).toBe('all')
            expect(state.input).toBe('')
        })

        it('should add todo', async () => {
            const result0 = await store.runCommand(todoApp$.updateInput('Test todo'))
            const result1 = await store.runCommand(todoApp$.addTodo())

            const state = store.getState()

            expect(state.todos.length).toBe(1)
            expect(state.todos[0].text).toBe('Test todo')
            expect(state.todos[0].done).toBe(false)
        })

        it('should clear input after adding todo', async () => {
            await store.runCommand(todoApp$.updateInput('Test todo'))
            await store.runCommand(todoApp$.addTodo())

            const state = store.getState()
            expect(state.input).toBe('')
        })
    })

    describe('todo operations', () => {
        beforeEach(async () => {
            await store.runCommand(todoApp$.updateInput('Todo 1'))
            await store.runCommand(todoApp$.addTodo())
            await store.runCommand(todoApp$.updateInput('Todo 2'))
            await store.runCommand(todoApp$.addTodo())
        })

        it('should update todo text', () => {
            const todoId = store.getState().todos[0].id
            store.runCommand(todoApp$.todos.todo(todoId).updateTodoText('Updated text'))

            const state = store.getState()
            expect(state.todos[0].text).toBe('Updated text')
        })

        it('should toggle todo status', () => {
            const todoId = store.getState().todos[0].id
            store.runCommand(todoApp$.todos.todo(todoId).toggleTodo())

            const state = store.getState()
            expect(state.todos[0].done).toBe(true)
        })
    })

    describe('filter operations', () => {
        beforeEach(async () => {
            await store.runCommand(todoApp$.updateInput('Active 1'))
            await store.runCommand(todoApp$.addTodo())
            await store.runCommand(todoApp$.updateInput('Active 2'))
            await store.runCommand(todoApp$.addTodo())
            await store.runCommand(todoApp$.updateInput('Completed 1'))
            await store.runCommand(todoApp$.addTodo())

            const todoId = store.getState().todos[2].id
            store.runCommand(todoApp$.todos.todo(todoId).toggleTodo())
        })

        it('should filter active todos', () => {
            const result = store.get(todoApp$.todos.activeTodoList)

            if (result.type === 'err') {
                throw new Error('Expected todos but got error')
            }

            expect(result.value.length).toBe(2)
            expect(result.value.every((todo: Todo) => !todo.done)).toBe(true)
        })

        it('should filter completed todos', () => {
            const result = store.get(todoApp$.todos.completedTodoList)

            if (result.type === 'err') {
                throw new Error('Expected todos but got error')
            }

            expect(result.value.length).toBe(1)
            expect(result.value.every((todo: Todo) => todo.done)).toBe(true)
        })

        it('should get active todo texts', () => {
            const result = store.get(todoApp$.todos.activeTodoTextList)

            if (result.type === 'err') {
                throw new Error('Expected texts but got error')
            }

            expect(result.value).toEqual(['Active 1', 'Active 2'])
        })

        it('should get completed todo texts', () => {
            const result = store.get(todoApp$.todos.completedTodoTextList)

            if (result.type === 'err') {
                throw new Error('Expected texts but got error')
            }

            expect(result.value).toEqual(['Completed 1'])
        })
    })

    describe('texts object', () => {
        beforeEach(async () => {
            await store.runCommand(todoApp$.updateInput('Todo 1'))
            await store.runCommand(todoApp$.addTodo())
            await store.runCommand(todoApp$.updateInput('Todo 2'))
            await store.runCommand(todoApp$.addTodo())

            const todoId = store.getState().todos[1].id
            store.runCommand(todoApp$.todos.todo(todoId).toggleTodo())
        })

        it('should get texts object', () => {
            const result = store.get(todoApp$.todos.texts)

            if (result.type === 'err') {
                throw new Error('Expected texts but got error')
            }

            expect(result.value).toEqual({
                active: ['Todo 1'],
                completed: ['Todo 2'],
            })
        })

        it('should update texts object', () => {
            store.set(todoApp$.todos.texts, (texts) => ({
                active: texts.active.map((text) => text + ' (active)'),
                completed: texts.completed.map((text) => text + ' (completed)'),
            }))

            const result = store.get(todoApp$.todos.texts)

            if (result.type === 'err') {
                throw new Error('Expected texts but got error')
            }

            expect(result.value).toEqual({
                active: ['Todo 1 (active)'],
                completed: ['Todo 2 (completed)'],
            })
        })
    })

    describe('async operations', () => {
        it('should handle async input update', async () => {
            const result = await store.runCommand(todoApp$.updateInput('Async test'))

            if (result.type === 'err') {
                throw new Error('Expected success but got error')
            }

            expect(result.value).toBe('Input updated')

            const state = store.getState()

            expect(state.input).toBe('Async test')
        })
    })
})

describe('Custom Context in Store', () => {
    class StoreWithCustomContext extends Store<number> {
        context = {
            a: 1,
            b: (n: number) => n + 1,
        }
    }

    let store: StoreWithCustomContext

    beforeEach(() => {
        store = new StoreWithCustomContext({
            state: 0,
        })
    })

    it('should get context value', () => {
        const result = store.runQuery(Eff.ctx('a').get<number>())

        expect(result).toEqual({
            type: 'ok',
            value: 1,
        })
    })

    it('should get context function result', () => {
        const result = store.runQuery(function* () {
            const b = yield* Eff.ctx('b').get<(n: number) => number>()

            return b(1)
        })

        expect(result).toEqual({
            type: 'ok',
            value: 2,
        })
    })
})
