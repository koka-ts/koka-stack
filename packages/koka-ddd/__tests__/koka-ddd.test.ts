import * as Optic from 'koka-optic'
import * as Async from 'koka/async'
import * as Koka from 'koka'
import * as Result from 'koka/result'
import * as Err from 'koka/err'
import * as Store from '../src/koka-ddd.ts'

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

class TextDomain<Root> extends Store.Domain<string, Root> {
    *updateText(text: string) {
        yield* this.set(text)
        return 'text updated'
    }
    *clearText() {
        yield* this.set('')
        return 'text cleared'
    }
}

class BoolDomain<Root> extends Store.Domain<boolean, Root> {
    *toggle() {
        yield* this.set((value) => !value)
        return 'bool toggled'
    }
}

class TodoDomain<Root> extends Store.Domain<Todo, Root> {
    text$ = new TextDomain(this.prop('text'))
    done$ = new BoolDomain(this.prop('done'));

    *updateTodoText(text: string) {
        const done = yield* this.done$.get()
        yield* this.text$.updateText(text)
        return 'todo updated'
    }

    *toggleTodo() {
        yield* this.done$.toggle()
        return 'todo toggled'
    }
}

let todoUid = 0

class TodoListDomain<Root> extends Store.Domain<Todo[], Root> {
    *addTodo(text: string) {
        const newTodo = {
            id: todoUid++,
            text,
            done: false,
        }
        yield* this.set((todos) => [...todos, newTodo])

        return 'todo added'
    }

    todo(id: number) {
        return new TodoDomain(this.find((todo) => todo.id === id))
    }

    getKey = (todo: Todo) => {
        return todo.id
    }

    completedTodoList$ = this.filter((todo) => todo.done)
    activeTodoList$ = this.filter((todo) => !todo.done)
    activeTodoTextList$ = this.activeTodoList$.map((todo$) => todo$.prop('text'))
    completedTodoTextList$ = this.completedTodoList$.map((todo$) => todo$.prop('text'))
}

class TodoInputErr extends Err.Err('TodoInputErr')<string> {}

class TodoAppDomain<Root> extends Store.Domain<TodoApp, Root> {
    todos$ = new TodoListDomain(this.prop('todos'))
    input$ = new TextDomain(this.prop('input'));

    *addTodo() {
        const todoApp = yield* this.get()

        if (todoApp.input === '') {
            throw yield* Err.throw(new TodoInputErr('Input is empty'))
        }

        yield* this.todos$.addTodo(todoApp.input)
        yield* this.updateInput('')
        return 'Todo added'
    }

    *updateInput(input: string) {
        yield* Async.await(Promise.resolve('test async'))
        yield* this.input$.updateText(input)
        return 'Input updated'
    }
}

describe('TodoAppStore', () => {
    let store: Store.Store<TodoApp>

    beforeEach(() => {
        const state: TodoApp = {
            todos: [],
            filter: 'all',
            input: '',
        }

        store = new Store.Store({
            state,
        })
    })

    it('should add a todo', async () => {
        const todoAppDomain = new TodoAppDomain(store.domain)
        const result: Async.MaybePromise<Result.Result<string, Err.AnyErr>> = Result.run(todoAppDomain.addTodo())

        expect(await result).toEqual({
            type: 'err',
            name: 'TodoInputErr',
            error: 'Input is empty',
        })

        const result2: Async.MaybePromise<Result.Result<string, Err.AnyErr>> = Result.run(
            todoAppDomain.updateInput('test'),
        )
        expect(await result2).toEqual({
            type: 'ok',
            value: 'Input updated',
        })

        const result3: Async.MaybePromise<Result.Result<string, Err.AnyErr>> = Result.run(todoAppDomain.addTodo())

        expect(await result3).toEqual({
            type: 'ok',
            value: 'Todo added',
        })

        const todos: Result.Result<Todo[], Optic.OpticErr> = Result.run(todoAppDomain.todos$.get())

        expect(todos).toEqual({
            type: 'ok',
            value: [
                {
                    id: 0,
                    text: 'test',
                    done: false,
                },
            ],
        })
    })
})
