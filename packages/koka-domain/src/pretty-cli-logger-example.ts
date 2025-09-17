import { Store, Domain, command, query, get, set } from './koka-domain'
import { PrettyLogger } from './pretty-cli-logger'

// 示例：Todo 应用
interface TodoItem {
    id: string
    text: string
    completed: boolean
}

interface AppState {
    todos: TodoItem[]
    filter: 'all' | 'active' | 'completed'
}

class TodoDomain extends Domain<TodoItem[], AppState> {
    @command()
    *addTodo(text: string) {
        const todos = yield* get(this)
        const newTodo: TodoItem = {
            id: Date.now().toString(),
            text,
            completed: false
        }
        yield* set(this, [...todos, newTodo])
        return newTodo
    }

    @command()
    *toggleTodo(id: string) {
        const todos = yield* get(this)
        const updatedTodos = todos.map(todo => 
            todo.id === id 
                ? { ...todo, completed: !todo.completed }
                : todo
        )
        yield* set(this, updatedTodos)
    }

    @command()
    *deleteTodo(id: string) {
        const todos = yield* get(this)
        yield* set(this, todos.filter(todo => todo.id !== id))
    }

    @query()
    *getActiveTodos() {
        const todos = yield* get(this)
        return todos.filter(todo => !todo.completed)
    }

    @query()
    *getCompletedTodos() {
        const todos = yield* get(this)
        return todos.filter(todo => todo.completed)
    }

    @query()
    *getTodoCount() {
        const todos = yield* get(this)
        const activeTodos = yield* this.getActiveTodos()
        const completedTodos = yield* this.getCompletedTodos()
        
        return {
            total: todos.length,
            active: activeTodos.length,
            completed: completedTodos.length
        }
    }
}

class FilterDomain extends Domain<AppState['filter'], AppState> {
    @command()
    *setFilter(filter: AppState['filter']) {
        yield* set(this, filter)
    }

    @query()
    *getCurrentFilter() {
        return yield* get(this)
    }
}

class AppDomain extends Domain<AppState, AppState> {
    todos = new TodoDomain({ store: this.store, optic: this.optic.prop('todos') })
    filter = new FilterDomain({ store: this.store, optic: this.optic.prop('filter') })

    @command()
    *clearCompleted() {
        const completedTodos = yield* this.todos.getCompletedTodos()
        for (const todo of completedTodos) {
            yield* this.todos.deleteTodo(todo.id)
        }
    }

    @query()
    *getVisibleTodos() {
        const filter = yield* this.filter.getCurrentFilter()
        const todos = yield* get(this.todos)
        
        switch (filter) {
            case 'active':
                return yield* this.todos.getActiveTodos()
            case 'completed':
                return yield* this.todos.getCompletedTodos()
            default:
                return todos
        }
    }

    @query()
    *getAppStats() {
        const stats = yield* this.todos.getTodoCount()
        const filter = yield* this.filter.getCurrentFilter()
        const visibleTodos = yield* this.getVisibleTodos()
        
        return {
            ...stats,
            currentFilter: filter,
            visibleCount: visibleTodos.length
        }
    }
}

// 使用示例
export function runExample() {
    console.log('🚀 启动 Todo 应用示例...\n')

    // 创建 store，使用不同的配置选项
    const store = new Store<AppState>({
        state: {
            todos: [],
            filter: 'all'
        },
        enhancers: [
            // 默认配置 - 显示所有内容
            PrettyLogger(),
            
            // 也可以使用自定义配置
            // PrettyLogger({
            //     compactMode: true,     // 紧凑模式
            //     showStates: true,       // 显示状态
            //     maxDepth: 5,           // 最大深度
            // })
        ]
    })

    const app = new AppDomain({ store, optic: store.domain.optic })

    // 执行一些操作来展示日志
    console.log('📝 执行一系列操作...\n')

    // 添加待办事项
    const gen1 = app.todos.addTodo('学习 TypeScript')
    const result1 = gen1.next()
    console.log('添加的待办:', result1.value)

    // 添加更多待办
    app.todos.addTodo('完成项目文档').next()
    app.todos.addTodo('代码审查').next()

    // 切换待办状态
    const todos = store.getState().todos
    if (todos[0]) {
        app.todos.toggleTodo(todos[0].id).next()
    }

    // 查询统计信息
    const stats = app.getAppStats().next()
    console.log('\n📊 应用统计:', stats.value)

    // 设置过滤器
    app.filter.setFilter('active').next()

    // 获取可见待办
    const visibleTodos = app.getVisibleTodos().next()
    console.log('\n👁️ 可见待办项:', visibleTodos.value)

    // 清理已完成项
    app.clearCompleted().next()

    console.log('\n✅ 示例运行完成!')
}

// 如果直接运行此文件
if (require.main === module) {
    runExample()
}