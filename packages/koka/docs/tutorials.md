# Koka 教程

本教程将带你从零开始学习 Koka，通过实际示例掌握效果管理的基本概念。

## 从零开始

### 什么是 Koka？

Koka 是一个基于代数效应的 TypeScript 效果管理库。它让你能够以类型安全的方式处理错误、管理上下文和执行异步操作。

### 安装和设置

首先安装 Koka：

```bash
npm install koka
```

创建一个新的 TypeScript 项目并导入 Koka：

```typescript
import { Eff } from 'koka'
```

### 你的第一个 Koka 程序

让我们从一个简单的示例开始：

```typescript
import { Eff } from 'koka'

// 定义一个简单的效果函数
function* greet(name: string) {
    if (!name) {
        yield* Eff.err('ValidationError').throw('Name is required')
    }
    return `Hello, ${name}!`
}

// 运行效果
const result = Eff.run(
    Eff.try(greet('World')).handle({
        ValidationError: (error) => `Error: ${error}`,
    }),
)

console.log(result) // 输出: "Hello, World!"
```

这个简单的例子展示了 Koka 的核心概念：

-   使用生成器函数定义效果
-   使用 `Eff.err()` 抛出错误效果
-   使用 `Eff.try().handle()` 处理效果
-   使用 `Eff.run()` 运行效果

## 错误处理基础

### 理解错误效果

在 Koka 中，错误被表示为"效果"而不是异常。这意味着错误是类型安全的，并且可以在编译时检查。

```typescript
function* divide(a: number, b: number) {
    if (b === 0) {
        yield* Eff.err('DivisionByZero').throw('Cannot divide by zero')
    }
    return a / b
}

// 处理错误
const result = Eff.run(
    Eff.try(divide(10, 0)).handle({
        DivisionByZero: (error) => {
            console.error(error)
            return null
        },
    }),
)

console.log(result) // 输出: null
```

### 错误传播

错误效果会在函数调用链中传播，直到被处理：

```typescript
function* calculate(a: number, b: number) {
    const result = yield* divide(a, b)
    return result * 2
}

function* main() {
    const result = yield* calculate(10, 0)
    return result
}

// 错误会传播到顶层
const result = Eff.run(
    Eff.try(main()).handle({
        DivisionByZero: (error) => `Handled: ${error}`,
    }),
)

console.log(result) // 输出: "Handled: Cannot divide by zero"
```

## 上下文管理

### 理解上下文效果

上下文效果允许你访问外部提供的值，类似于依赖注入：

```typescript
function* getUserInfo() {
    const userId = yield* Eff.ctx('UserId').get<string>()
    const apiKey = yield* Eff.ctx('ApiKey').get<string>()

    return `User ${userId} with API key ${apiKey.slice(0, 5)}...`
}

// 提供上下文值
const result = Eff.run(
    Eff.try(getUserInfo()).handle({
        UserId: '12345',
        ApiKey: 'secret-api-key-123',
    }),
)

console.log(result) // 输出: "User 12345 with API key secre..."
```

### 可选上下文

使用 `opt()` 方法可以获取可选的上下文值：

```typescript
function* getUserPreferences() {
    const theme = yield* Eff.ctx('Theme').opt<string>()
    const fontSize = yield* Eff.ctx('FontSize').opt<number>()

    return {
        theme: theme ?? 'light',
        fontSize: fontSize ?? 14,
    }
}

// 不提供任何上下文值
const result = Eff.run(getUserPreferences())
console.log(result) // 输出: { theme: 'light', fontSize: 14 }

// 提供部分上下文值
const result2 = Eff.run(
    Eff.try(getUserPreferences()).handle({
        Theme: 'dark',
    }),
)
console.log(result2) // 输出: { theme: 'dark', fontSize: 14 }
```

## 异步编程

### 处理异步操作

Koka 使用 `Eff.await()` 来处理异步操作：

```typescript
async function* fetchUserData(userId: string) {
    const response = yield* Eff.await(fetch(`/api/users/${userId}`))

    if (!response.ok) {
        yield* Eff.err('FetchError').throw(`Failed to fetch user: ${response.status}`)
    }

    return response.json()
}

// 运行异步效果
const result = await Eff.run(
    Eff.try(fetchUserData('123')).handle({
        FetchError: (error) => ({ error }),
    }),
)
```

### 组合同步和异步操作

你可以在同一个生成器函数中混合使用同步和异步操作：

```typescript
async function* processUser(userId: string) {
    // 同步验证
    if (!userId) {
        yield* Eff.err('ValidationError').throw('User ID is required')
    }

    // 获取配置（同步上下文）
    const apiUrl = yield* Eff.ctx('ApiUrl').get<string>()

    // 异步获取数据
    const userData = yield* Eff.await(fetch(`${apiUrl}/users/${userId}`))

    // 处理响应
    if (!userData.ok) {
        yield* Eff.err('ApiError').throw('API request failed')
    }

    return userData.json()
}

// 运行组合效果
const result = await Eff.run(
    Eff.try(processUser('123')).handle({
        ValidationError: (error) => ({ error }),
        ApiError: (error) => ({ error }),
        ApiUrl: 'https://api.example.com',
    }),
)
```

## 设计优先方法

### 预定义效果类型

Koka 鼓励你预先定义效果类型，这样可以获得更好的类型安全性和代码组织：

```typescript
// 预定义错误效果
class UserNotFound extends Eff.Err('UserNotFound')<string> {}
class ValidationError extends Eff.Err('ValidationError')<{ field: string; message: string }> {}

// 预定义上下文效果
class DatabaseConnection extends Eff.Ctx('Database')<{ query: (sql: string) => Promise<any> }> {}
class Logger extends Eff.Opt('Logger')<(level: string, message: string) => void> {}

// 使用预定义的效果
function* getUser(userId: string) {
    const logger = yield* Eff.get(Logger)
    const db = yield* Eff.get(DatabaseConnection)

    logger?.('info', `Fetching user ${userId}`)

    if (!userId) {
        yield* Eff.throw(new ValidationError({ field: 'userId', message: 'Required' }))
    }

    const user = yield* Eff.await(db.query(`SELECT * FROM users WHERE id = '${userId}'`))

    if (!user) {
        yield* Eff.throw(new UserNotFound(`User ${userId} not found`))
    }

    logger?.('info', `User ${userId} found`)
    return user
}

// 运行程序
const result = await Eff.run(
    Eff.try(getUser('123')).handle({
        UserNotFound: (error) => ({ error }),
        ValidationError: (error) => ({ error }),
        Database: { query: async (sql) => ({ id: '123', name: 'John' }) },
        Logger: (level, message) => console.log(`[${level}] ${message}`),
    }),
)
```

### 效果组合

你可以组合多个效果来创建复杂的程序：

```typescript
function* createUser(userData: { name: string; email: string }) {
    const db = yield* Eff.get(DatabaseConnection)
    const logger = yield* Eff.get(Logger)

    // 验证用户数据
    if (!userData.name) {
        yield* Eff.throw(new ValidationError({ field: 'name', message: 'Required' }))
    }

    if (!userData.email) {
        yield* Eff.throw(new ValidationError({ field: 'email', message: 'Required' }))
    }

    logger?.('info', `Creating user ${userData.name}`)

    // 检查邮箱是否已存在
    const existingUser = yield* Eff.await(db.query(`SELECT id FROM users WHERE email = '${userData.email}'`))

    if (existingUser) {
        yield* Eff.throw(new ValidationError({ field: 'email', message: 'Already exists' }))
    }

    // 创建用户
    const newUser = yield* Eff.await(
        db.query(`INSERT INTO users (name, email) VALUES ('${userData.name}', '${userData.email}') RETURNING *`),
    )

    logger?.('info', `User ${newUser.id} created successfully`)
    return newUser
}

// 运行用户创建程序
const result = await Eff.run(
    Eff.try(createUser({ name: 'Jane Doe', email: 'jane@example.com' })).handle({
        ValidationError: (error) => ({ error }),
        Database: { query: async (sql) => ({ id: '456', name: 'Jane Doe', email: 'jane@example.com' }) },
        Logger: (level, message) => console.log(`[${level}] ${message}`),
    }),
)
```

## 下一步

现在你已经掌握了 Koka 的基础知识！接下来你可以：

1. 查看 [操作指南](./how-to-guides.md) 学习解决具体问题的方法
2. 阅读 [API 参考](./reference.md) 了解完整的 API
3. 深入 [概念解释](./explanations.md) 理解 Koka 的设计理念

记住，Koka 的核心优势在于：

-   **类型安全**：所有效果都在编译时检查
-   **可组合性**：效果可以自然地组合和嵌套
-   **简洁性**：最小化的 API 设计
-   **灵活性**：支持同步和异步操作
