import * as DDD from 'koka-ddd'
import * as Async from 'koka/async'
import * as Err from 'koka/err'

export type Todo = {
    id: number
    text: string
    done: boolean
}

export type TodoFilter = 'all' | 'done' | 'undone'

export type TodoApp = {
    todos: Todo[]
    filter: TodoFilter
    input: string
}

export class TextDomain<Root> extends DDD.Domain<string, Root> {
    @DDD.command()
    *updateText(text: string) {
        yield* this.set(text)
        return 'text updated'
    }
    @DDD.command()
    *clearText() {
        yield* this.set('')
        return 'text cleared'
    }
}

export class BoolDomain<Root> extends DDD.Domain<boolean, Root> {
    @DDD.command()
    *toggle() {
        yield* this.set((value) => !value)
        return 'bool toggled'
    }
}

export class TodoDomain<Root> extends DDD.Domain<Todo, Root> {
    text$ = new TextDomain(this.prop('text'))
    done$ = new BoolDomain(this.prop('done'));

    @DDD.command()
    *updateTodoText(text: string) {
        yield* this.text$.updateText(text)
        return 'todo updated'
    }

    @DDD.command()
    *toggleTodo() {
        yield* this.done$.toggle()
        return 'todo toggled'
    }
}

let todoUid = 100

export class TodoListDomain<Root> extends DDD.Domain<Todo[], Root> {
    @DDD.command()
    *addTodo(text: string) {
        const newTodo = {
            id: todoUid++,
            text,
            done: false,
        }
        yield* this.set((todos) => [...todos, newTodo])

        return 'todo added'
    }

    @DDD.command()
    *toggleAll() {
        const todos = yield* this.get()
        const allDone = todos.every((todo) => todo.done)
        yield* this.set((todos) => todos.map((todo) => ({ ...todo, done: !allDone })))
        return 'all todos toggled'
    }

    @DDD.command()
    *clearCompleted() {
        yield* this.set((todos) => todos.filter((todo) => !todo.done))
        return 'completed todos cleared'
    }

    @DDD.command()
    *removeTodo(id: number) {
        yield* this.set((todos) => todos.filter((todo) => todo.id !== id))
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
    completedTodoTextList$ = this.completedTodoList$.map((todo$) => todo$.prop('text'))
}

export class TodoFilterDomain<Root> extends DDD.Domain<TodoFilter, Root> {
    @DDD.command()
    *setFilter(filter: TodoFilter) {
        yield* this.set(filter)
        return 'filter set'
    }
}

export class TodoInputErr extends Err.Err('TodoInputErr')<string> {}

export class TodoAppDomain<Root> extends DDD.Domain<TodoApp, Root> {
    todos$ = new TodoListDomain(this.prop('todos'))
    filter$ = new TodoFilterDomain(this.prop('filter'))
    input$ = new TextDomain(this.prop('input'));

    @DDD.command()
    *addTodo() {
        const todoApp = yield* this.get()

        if (todoApp.input === '') {
            throw yield* Err.throw(new TodoInputErr('Input is empty'))
        }

        yield* this.todos$.addTodo(todoApp.input)
        yield* this.updateInput('')
        return 'Todo added'
    }

    @DDD.command()
    *updateInput(input: string) {
        yield* Async.await(Promise.resolve('test async'))
        yield* this.input$.updateText(input)
        return 'Input updated'
    }
}
