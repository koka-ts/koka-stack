import * as DDD from 'koka-ddd'
import * as Async from 'koka/async'
import * as Err from 'koka/err'

export interface TodoStorage {
    saveTodoList(todoList: Todo[]): Promise<void>
    loadTodoList(): Promise<Todo[]>
}

export interface TodoStorageEnhancer {
    todoStorage: TodoStorage
}

export interface TextLoggerEnhancer {
    logText(text: string): void
}

export class CoreDomain<State, Root = any> extends DDD.Domain<State, Root, TextLoggerEnhancer & TodoStorageEnhancer> {}

export class TextDomain extends CoreDomain<string> {
    @DDD.command()
    *updateText(text: string) {
        this.store.logText(`updateText: ${text}`)
        yield* DDD.set(this, text)
        return 'text updated'
    }
    @DDD.command()
    *clearText() {
        this.store.logText(`clearText`)
        yield* DDD.set(this, '')
        return 'text cleared'
    }
}

export class BoolDomain extends CoreDomain<boolean> {
    @DDD.command()
    *toggle() {
        yield* DDD.set(this, (value) => !value)
        return 'bool toggled'
    }
}

// Event definition - only for operations that sub-domain cannot handle itself
export class RemoveTodoEvent extends DDD.Event('RemoveTodo')<{ todoId: number }> {}

export type Todo = {
    id: number
    text: string
    done: boolean
}

export class TodoDomain extends CoreDomain<Todo> {
    text$ = new TextDomain(this.prop('text'))
    done$ = new BoolDomain(this.prop('done'));

    @DDD.command()
    *updateTodoText(text: string) {
        // Can be handled within the domain, no event needed
        yield* this.text$.updateText(text)
        return 'todo updated'
    }

    @DDD.command()
    *toggleTodo() {
        // Can be handled within the domain, no event needed
        yield* this.done$.toggle()
        return 'todo toggled'
    }

    @DDD.command()
    *removeTodo() {
        // Cannot remove itself from the list, needs to emit event to parent domain
        const todo = yield* DDD.get(this)
        yield* DDD.emit(this, new RemoveTodoEvent({ todoId: todo.id }))
        return 'todo remove requested'
    }
}

let todoUid = 100

export class TodoListDomain extends CoreDomain<Todo[]> {
    @DDD.command()
    *addTodo(text: string) {
        const newTodo = {
            id: todoUid++,
            text,
            done: false,
        }
        yield* DDD.set(this, (todos) => [...todos, newTodo])

        return 'todo added'
    }

    @DDD.command()
    *toggleAll() {
        const todos = yield* DDD.get(this)
        const allDone = todos.every((todo) => todo.done)

        // Can be handled directly within this domain
        yield* DDD.set(this, (todos) => {
            return todos.map((todo) => ({ ...todo, done: !allDone }))
        })

        return 'all todos toggled'
    }

    @DDD.command()
    *clearCompleted() {
        // Can be handled directly within this domain
        yield* DDD.set(this, (todos) => todos.filter((todo) => !todo.done))
        return 'completed todos cleared'
    }

    @DDD.command()
    *removeTodo(id: number) {
        yield* DDD.set(this, (todos) => todos.filter((todo) => todo.id !== id))
        return 'todo removed'
    }

    // Event handler - only handle events from sub-domains that cannot be handled locally
    @DDD.event(RemoveTodoEvent)
    *handleRemoveTodo(event: RemoveTodoEvent) {
        yield* this.removeTodo(event.payload.todoId)
    }

    todo(id: number) {
        const options = this.find((todo) => todo.id === id)
        return new TodoDomain(options) as TodoDomain
    }

    getKey = (todo: Todo) => {
        return todo.id
    }

    completedTodoList$ = this.filter((todo) => todo.done)
    activeTodoList$ = this.filter((todo) => !todo.done)
    activeTodoTextList$ = this.activeTodoList$.map((todo$) => todo$.prop('text'))
    completedTodoTextList$ = this.completedTodoList$.map((todo$) => todo$.prop('text'));

    @DDD.query()
    *getCompletedTodoList() {
        const completedTodoList = yield* DDD.get(this.completedTodoList$)
        return completedTodoList
    }

    @DDD.query()
    *getActiveTodoList() {
        const activeTodoList = yield* DDD.get(this.activeTodoList$)
        return activeTodoList
    }

    @DDD.query()
    *getActiveTodoTextList() {
        const activeTodoTextList = yield* DDD.get(this.activeTodoTextList$)
        return activeTodoTextList
    }

    @DDD.query()
    *getCompletedTodoTextList() {
        const completedTodoTextList = yield* DDD.get(this.completedTodoTextList$)
        return completedTodoTextList
    }

    @DDD.query()
    *getTodoCount() {
        const todoList = yield* DDD.get(this)
        return todoList.length
    }

    @DDD.query()
    *getCompletedTodoCount() {
        const completedTodoList = yield* DDD.get(this.completedTodoList$)
        return completedTodoList.length
    }

    @DDD.query()
    *getActiveTodoCount() {
        const activeTodoList = yield* DDD.get(this.activeTodoList$)
        return activeTodoList.length
    }
}

export type TodoFilter = 'all' | 'done' | 'undone'

export class TodoFilterDomain extends CoreDomain<TodoFilter> {
    @DDD.command()
    *setFilter(filter: TodoFilter) {
        yield* DDD.set(this, filter)
        return 'filter set'
    }
}

export class TodoInputErr extends Err.Err('TodoInputErr')<string> {}

export type TodoApp = {
    todos: Todo[]
    filter: TodoFilter
    input: string
}

export class TodoAppDomain extends CoreDomain<TodoApp> {
    todos$ = new TodoListDomain(this.prop('todos'))
    filter$ = new TodoFilterDomain(this.prop('filter'))
    input$ = new TextDomain(this.prop('input'));

    @DDD.command()
    *addTodo() {
        const todoApp = yield* DDD.get(this)

        if (todoApp.input === '') {
            throw yield* Err.throw(new TodoInputErr('Input is empty'))
        }

        yield* this.todos$.addTodo(todoApp.input)
        yield* this.input$.clearText()
        return 'Todo added'
    }

    @DDD.command()
    *updateInput(input: string) {
        yield* Async.await(Promise.resolve('test async'))
        yield* this.input$.updateText(input)
        return 'Input updated'
    }

    @DDD.query()
    *getFilteredTodoList() {
        const todoList = yield* DDD.get(this.todos$)
        const filter = yield* DDD.get(this.filter$)

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

    @DDD.query()
    *getFilteredTodoIds() {
        const todoList = yield* this.getFilteredTodoList()
        return todoList.map((todo) => todo.id)
    }
}
