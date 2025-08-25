import { Domain, command, get, query, set } from 'koka-domain'
import * as Async from 'koka/async'
import * as Err from 'koka/err'

export class TextDomain extends Domain<string> {
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

export class BoolDomain extends Domain<boolean> {
    @command()
    *toggle() {
        yield* set(this, (value) => !value)
        return 'bool toggled'
    }
}

export type Todo = {
    id: number
    text: string
    done: boolean
}

export class TodoDomain extends Domain<Todo> {
    text$ = new TextDomain(this.prop('text'))
    done$ = new BoolDomain(this.prop('done'));

    @command()
    *updateTodoText(text: string) {
        yield* this.text$.updateText(text)
        return 'todo updated'
    }

    @command()
    *toggleTodo() {
        yield* this.done$.toggle()
        return 'todo toggled'
    }
}

let todoUid = 100

export class TodoListDomain extends Domain<Todo[]> {
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

    @command()
    *toggleAll() {
        const todos = yield* get(this)
        const allDone = todos.every((todo) => todo.done)

        yield* set(this, (todos) => {
            return todos.map((todo) => ({ ...todo, done: !allDone }))
        })

        return 'all todos toggled'
    }

    @command()
    *clearCompleted() {
        yield* set(this, (todos) => todos.filter((todo) => !todo.done))
        return 'completed todos cleared'
    }

    @command()
    *removeTodo(id: number) {
        yield* set(this, (todos) => todos.filter((todo) => todo.id !== id))
        return 'todo removed'
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
    completedTodoTextList$ = this.completedTodoList$.map((todo$) => todo$.prop('text'));

    @query()
    *getCompletedTodoList() {
        const completedTodoList = yield* get(this.completedTodoList$)
        return completedTodoList
    }

    @query()
    *getActiveTodoList() {
        const activeTodoList = yield* get(this.activeTodoList$)
        return activeTodoList
    }

    @query()
    *getActiveTodoTextList() {
        const activeTodoTextList = yield* get(this.activeTodoTextList$)
        return activeTodoTextList
    }

    @query()
    *getCompletedTodoTextList() {
        const completedTodoTextList = yield* get(this.completedTodoTextList$)
        return completedTodoTextList
    }

    @query()
    *getTodoCount() {
        const todoList = yield* get(this)
        return todoList.length
    }

    @query()
    *getCompletedTodoCount() {
        const completedTodoList = yield* get(this.completedTodoList$)
        return completedTodoList.length
    }

    @query()
    *getActiveTodoCount() {
        const activeTodoList = yield* get(this.activeTodoList$)
        return activeTodoList.length
    }
}

export type TodoFilter = 'all' | 'done' | 'undone'

export class TodoFilterDomain extends Domain<TodoFilter> {
    @command()
    *setFilter(filter: TodoFilter) {
        yield* set(this, filter)
        return 'filter set'
    }
}

export class TodoInputErr extends Err.Err('TodoInputErr')<string> {}

export type TodoApp = {
    todos: Todo[]
    filter: TodoFilter
    input: string
}

export class TodoAppDomain extends Domain<TodoApp> {
    todos$ = new TodoListDomain(this.prop('todos'))
    filter$ = new TodoFilterDomain(this.prop('filter'))
    input$ = new TextDomain(this.prop('input'));

    @command()
    *addTodo() {
        const todoApp = yield* get(this)

        if (todoApp.input === '') {
            throw yield* Err.throw(new TodoInputErr('Input is empty'))
        }

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
        const todoList = yield* get(this.todos$)
        const filter = yield* get(this.filter$)

        if (filter === 'all') {
            return todoList
        }

        if (filter === 'done') {
            return todoList.filter((todo) => todo.done)
        }

        if (filter === 'undone') {
            return todoList.filter((todo) => !todo.done)
        }

        return todoList
    }

    @query()
    *getFilteredTodoIds() {
        const todoList = yield* this.getFilteredTodoList()
        return todoList.map((todo) => todo.id)
    }
}
