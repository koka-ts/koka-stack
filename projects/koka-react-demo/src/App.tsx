import * as Koka from 'koka'
import * as Result from 'koka/result'
import { useDomainSelector, useDomainState } from 'koka-react'
import './App.css'
import { type TodoFilter, TodoListDomain, TodoFilterDomain, TodoAppDomain, TodoDomain } from './domain'

// Components

type TodoItemProps<Root> = {
    todo$: TodoDomain<Root>
    onRemove?: (id: number) => void
}

function TodoItem<Root>(props: TodoItemProps<Root>) {
    const todo$ = props.todo$
    const todo = useDomainState(todo$)

    const handleToggle = () => {
        Koka.runUnSafe(todo$.toggleTodo())
    }

    const handleRemove = () => {
        props.onRemove?.(todo.id)
    }

    return (
        <li
            className={`group flex items-center gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200 ${
                todo.done ? 'bg-gray-50' : ''
            }`}
        >
            <input
                type="checkbox"
                checked={todo.done}
                onChange={handleToggle}
                className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
            />
            <span
                className={`flex-1 text-left text-gray-800 transition-all duration-200 ${
                    todo.done ? 'line-through text-gray-500' : ''
                }`}
            >
                {todo.text}
            </span>
            <button
                onClick={handleRemove}
                className="w-8 h-8 !bg-red-500 !hover:bg-red-600 text-white rounded-full flex items-center justify-center text-lg font-bold transition-colors duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
                ×
            </button>
        </li>
    )
}

type TodoInputProps<Root> = {
    todoApp$: TodoAppDomain<Root>
}

function TodoInput<Root>(props: TodoInputProps<Root>) {
    const todoApp$ = props.todoApp$
    const input = useDomainState(todoApp$.input$)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const program = Koka.try(todoApp$.addTodo()).handle({
            TodoInputErr: (message) => {
                alert(message)
            },
        })

        await Result.runAsync(program)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        Koka.runUnSafe(todoApp$.updateInput(e.target.value))
    }

    return (
        <form onSubmit={handleSubmit} className="flex gap-2 mb-6 min-w-0">
            <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="add a todo..."
                className="flex-1 min-w-0 px-3 py-2 border-2 border-gray-200 rounded-lg text-gray-800 placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors duration-200 text-sm"
            />
            <button
                type="submit"
                className="px-4 py-2 !bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm whitespace-nowrap"
            >
                add
            </button>
        </form>
    )
}

type TodoFilterProps<Root> = {
    filter$: TodoFilterDomain<Root>
}

function TodoFilter<Root>(props: TodoFilterProps<Root>) {
    const filter$ = props.filter$
    const currentFilter = useDomainState(filter$)

    const handleFilterChange = (filter: TodoFilter) => {
        Koka.runUnSafe(filter$.setFilter(filter))
    }

    const filterButtons = [
        { key: 'all' as const, label: 'all' },
        { key: 'undone' as const, label: 'undone' },
        { key: 'done' as const, label: 'done' },
    ]

    return (
        <div className="flex justify-center gap-2 mb-6">
            {filterButtons.map(({ key, label }) => (
                <button
                    key={key}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        currentFilter === key
                            ? '!bg-blue-600 !text-white shadow-md'
                            : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                    }`}
                    onClick={() => handleFilterChange(key)}
                >
                    {label}
                </button>
            ))}
        </div>
    )
}

type TodoStatsProps<Root> = {
    todoList$: TodoListDomain<Root>
}

function TodoStats<Root>(props: TodoStatsProps<Root>) {
    const todoList$ = props.todoList$
    const activeTodoList = useDomainState(todoList$.activeTodoList$)
    const completedTodoList = useDomainState(todoList$.completedTodoList$)

    const activeCount = activeTodoList.length
    const completedCount = completedTodoList.length
    const totalCount = activeCount + completedCount

    return (
        <div className="flex justify-around mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="text-center">
                <div className="text-2xl font-bold text-gray-800">{totalCount}</div>
                <div className="text-sm text-gray-600">total</div>
            </div>
            <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{activeCount}</div>
                <div className="text-sm text-gray-600">undone</div>
            </div>
            <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{completedCount}</div>
                <div className="text-sm text-gray-600">done</div>
            </div>
        </div>
    )
}

export type TodoListProps<Root> = {
    todoList$: TodoListDomain<Root>
    filter$: TodoFilterDomain<Root>
}

function TodoList<Root>(props: TodoListProps<Root>) {
    const todoList$ = props.todoList$
    const filter$ = props.filter$

    const filter = useDomainState(filter$)
    const todos = useDomainState(todoList$)
    const allCompleted = useDomainSelector(todoList$, (todos) => todos.length > 0 && todos.every((todo) => todo.done))
    const hasCompleted = useDomainSelector(todoList$, (todos) => todos.some((todo) => todo.done))

    const filteredTodos = useDomainSelector(todoList$, (todos) => {
        switch (filter) {
            case 'all':
                return todos
            case 'done':
                return todos.filter((todo) => todo.done)
            case 'undone':
                return todos.filter((todo) => !todo.done)
        }
    })

    const handleToggleAll = () => {
        Koka.runUnSafe(todoList$.toggleAll())
    }

    const handleClearCompleted = () => {
        Koka.runUnSafe(todoList$.clearCompleted())
    }

    const handleRemove = (id: number) => {
        Koka.runUnSafe(todoList$.removeTodo(id))
    }

    if (todos.length === 0) {
        return (
            <div className="text-center py-12 min-h-48 flex flex-col justify-center">
                <div className="text-gray-400 text-6xl mb-4">📝</div>
                <p className="text-gray-500 text-lg">no todos, add one!</p>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden min-h-48">
            {todos.length > 0 && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-100">
                    <input
                        type="checkbox"
                        checked={allCompleted}
                        onChange={handleToggleAll}
                        className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                    />
                    <span className="text-sm text-gray-600 cursor-pointer select-none">
                        {allCompleted ? 'unselect all' : 'select all'}
                    </span>
                </div>
            )}

            <ul className="divide-y divide-gray-100">
                {filteredTodos.map((todo) => (
                    <TodoItem key={todo.id} todo$={todoList$.todo(todo.id)} onRemove={handleRemove} />
                ))}
            </ul>

            {hasCompleted && (
                <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                    <button
                        onClick={handleClearCompleted}
                        className="px-4 py-2 !bg-blue-600 !hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                        clear done
                    </button>
                </div>
            )}
        </div>
    )
}

type AppProps<Root> = {
    todoApp$: TodoAppDomain<Root>
}

function App<Root>(props: AppProps<Root>) {
    const todoApp$ = props.todoApp$

    return (
        <div className="w-80 p-6 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl shadow-lg">
            <h1 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Todo App
            </h1>

            <TodoInput todoApp$={todoApp$} />
            <TodoFilter filter$={todoApp$.filter$} />
            <TodoStats todoList$={todoApp$.todos$} />
            <TodoList todoList$={todoApp$.todos$} filter$={todoApp$.filter$} />
        </div>
    )
}

export default App
