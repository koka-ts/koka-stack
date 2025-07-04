# Koka vs Effect-TS: 详细对比

本文档提供 Koka 和 Effect-TS 之间的深入对比，重点关注它们基于生成器的效果管理方法。

## 核心哲学

| 方面         | Koka           | Effect-TS          |
| ------------ | -------------- | ------------------ |
| **设计目标** | 轻量级效果管理 | 完整功能的效果系统 |
| **包大小**   | ~3kB           | ~50kB              |
| **学习曲线** | 低             | 高                 |

## 类型系统

### Effect-TS 效果类型

```typescript
         ┌─── 表示成功类型
         │        ┌─── 表示错误类型
         │        │      ┌─── 表示必需依赖
         ▼        ▼      ▼
Effect<Success, Error, Requirements>
```

### Koka 效果类型

```typescript
//                      ┌─── 返回类型
//                      │   ┌─── 错误效果类型
//                      │   │     ┌─── 上下文效果类型
//                      │   │     │     ┌─── 异步效果类型
//                      │   │     │     │     ┌─── 消息效果类型
//                      ▼   ▼     ▼     ▼     ▼
type Effect = Generator<T, Err | Ctx | Async | Msg>
```

主要区别：

-   Koka 使用更简单直接的生成器类型
-   Effect-TS 使用更复杂的类型系统

## 基于生成器的错误处理和异步处理

### Effect-TS 方法

```typescript
import { Effect, pipe } from 'effect'

const getUser = (id: string) =>
    Effect.gen(function* () {
        if (!id) {
            yield* Effect.fail({ _tag: 'ValidationError', message: 'ID required' })
        }

        const user = yield* Effect.tryPromise(() => fetch(`/users/${id}`))

        return user
    })

const result = await Effect.runPromise(
    pipe(
        getUser(''),
        Effect.catchTag('ValidationError', (e) => Effect.sync(() => console.error(e.message))),
    ),
)
```

### Koka 方法

```typescript
import { Eff } from 'koka'

function* getUser(id: string) {
    if (!id) {
        yield* Eff.err('ValidationError').throw('ID required')
    }

    const user = yield* Eff.await(fetch(`/users/${id}`))

    return user
}

const result = await Eff.run(
    Eff.try(getUser('')).handle({
        ValidationError: (message) => console.error(message),
    }),
)
```

主要架构差异：

-   **生成器实现**：
    -   Koka 使用原生生成器
    -   Effect-TS 用 `Effect.gen` 包装生成器
-   **错误处理**：
    -   Koka 采用命令式风格的方法
    -   Effect-TS 使用函数式错误通道
-   **异步操作**：
    -   Koka 自动推断异步操作
    -   Effect-TS 需要显式处理 via `Effect.runPromise`
-   **效果管理**：
    -   Koka 最小化包装要求
    -   Effect-TS 需要显式效果包装/解包

## 上下文和依赖管理

### Effect-TS 上下文

```typescript
import { Effect, Context } from 'effect'

// 声明一个生成随机数的服务标签
class Random extends Context.Tag('MyRandomService')<Random, { readonly next: Effect.Effect<number> }>() {}

// 使用服务
const program = Effect.gen(function* () {
    const random = yield* Random
    const randomNumber = yield* random.next
    console.log(`random number: ${randomNumber}`)
})

// 提供实现
//
//      ┌─── Effect<void, never, never>
//      ▼
const runnable = Effect.provideService(program, Random, {
    next: Effect.sync(() => Math.random()),
})

// 成功运行
Effect.runPromise(runnable)
/*
示例输出:
random number: 0.8241872233134417
*/
```

### Koka 上下文

```typescript
import { Eff } from 'koka'

const program = function* () {
    const getRandom = yield* Eff.ctx('MyRandom').get<() => number>()
    const randomNumber = getRandom()

    console.log(`random number: ${randomNumber}`)
}

// 提供实现
Eff.run(
    Eff.try(program).handle({
        MyRandom: () => Math.random(),
    }),
)
```

主要上下文管理差异：

-   **Effect-TS**：
    -   使用复杂的上下文系统与 `Context.Tag`
    -   提供类型安全的依赖注入
-   **Koka**：
    -   使用简单的基于字符串的上下文检索 via `Eff.ctx`
    -   提供更直接的设置

## 异步操作

### Koka 异步

```typescript
const data = yield * Eff.await(fetch('/data'))
```

### Effect-TS 异步

```typescript
const data = yield * Effect.tryPromise(() => fetch('/data'))
```

主要差异：

-   Koka 直接处理 Promise
-   Effect-TS 需要显式 Promise 转换
-   两者都支持 async/await 风格

## 效果组合

### Koka 效果组合

```typescript
// 并行组合
const [user, orders] = yield * Eff.combine([fetchUser(userId), fetchOrders(userId)])

// 对象组合
const result =
    yield *
    Eff.combine({
        user: fetchUser(userId),
        profile: fetchProfile(userId),
        settings: getDefaultSettings(),
    })

// 流式处理
const results =
    yield *
    Eff.stream([generator1(), generator2(), generator3()], async (stream) => {
        const processed = []
        for await (const { index, value } of stream) {
            processed[index] = `Processed: ${value}`
        }
        return processed
    })
```

### Effect-TS 效果组合

```typescript
// 并行组合
const [user, orders] = yield * Effect.all([fetchUser(userId), fetchOrders(userId)])

// 对象组合需要手动实现
const user = yield * fetchUser(userId)
const profile = yield * fetchProfile(userId)
const settings = yield * getDefaultSettings()
```

## 消息传递

### Koka 消息传递

```typescript
// 定义消息类型
class UserRequest extends Eff.Msg('UserRequest')<{ userId: string }> {}
class UserResponse extends Eff.Msg('UserResponse')<{ user: any }> {}

// 客户端生成器
function* userClient() {
    yield* Eff.send(new UserRequest({ userId: '123' }))
    const response = yield* Eff.wait(UserResponse)
    return `Client: ${response.user.name}`
}

// 服务端生成器
function* userServer() {
    const request = yield* Eff.wait(UserRequest)
    const user = { id: request.userId, name: 'John Doe' }
    yield* Eff.send(new UserResponse({ user }))
    return `Server: processed ${request.userId}`
}

// 运行通信
const result = Eff.runSync(
    Eff.communicate({
        client: userClient,
        server: userServer,
    }),
)
```

### Effect-TS 消息传递

Effect-TS 没有内置的消息传递机制，需要手动实现或使用外部库。

## 设计优先方法

### Koka 设计优先

```typescript
// 预定义错误效果
class UserNotFound extends Eff.Err('UserNotFound')<string> {}
class ValidationError extends Eff.Err('ValidationError')<{ field: string; message: string }> {}

// 预定义上下文效果
class DatabaseConnection extends Eff.Ctx('Database')<{ query: (sql: string) => Promise<any> }> {}
class Logger extends Eff.Opt('Logger')<(level: string, message: string) => void> {}

// 使用预定义效果
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
```

### Effect-TS 设计优先

```typescript
// 预定义错误类型
type UserError = { _tag: 'UserNotFound'; userId: string } | { _tag: 'ValidationError'; field: string; message: string }

// 预定义服务
class Database extends Context.Tag('Database')<
    Database,
    {
        readonly query: Effect.Effect<any, never, string>
    }
>() {}

class Logger extends Context.Tag('Logger')<
    Logger,
    {
        readonly log: Effect.Effect<void, never, { level: string; message: string }>
    }
>() {}

// 使用预定义类型
const getUser = (userId: string) =>
    Effect.gen(function* () {
        const logger = yield* Logger
        const db = yield* Database

        yield* logger.log({ level: 'info', message: `Fetching user ${userId}` })

        if (!userId) {
            yield* Effect.fail({ _tag: 'ValidationError', field: 'userId', message: 'Required' })
        }

        const user = yield* db.query(`SELECT * FROM users WHERE id = '${userId}'`)

        if (!user) {
            yield* Effect.fail({ _tag: 'UserNotFound', userId })
        }

        yield* logger.log({ level: 'info', message: `User ${userId} found` })
        return user
    })
```

## 何时选择

**选择 Koka 当：**

-   你需要轻量级效果管理
-   你想要最小化包大小
-   你需要快速集成
-   你的团队对函数式编程不熟悉

**选择 Effect-TS 当：**

-   你需要完整功能的效果系统和生态系统
-   你需要高级效果组合器
-   你的团队有函数式编程经验
-   你需要企业级功能

## 迁移指南

### 从 Effect-TS 到 Koka

1. 将 `Effect.gen` 替换为原生生成器
2. 将 `Effect.fail` 转换为 `Eff.err().throw()`
3. 将服务替换为上下文效果
4. 使用 `Eff.await` 替代 `Effect.tryPromise`

### 从 Koka 到 Effect-TS

1. 用 `Effect.gen` 包装生成器
2. 将字符串错误转换为标记联合
3. 将上下文替换为服务
4. 使用 Effect 的内置异步处理

## 性能对比

| 指标             | Koka | Effect-TS |
| ---------------- | ---- | --------- |
| **包大小**       | ~3kB | ~50kB     |
| **运行时开销**   | 低   | 中等      |
| **内存使用**     | 低   | 中等      |
| **启动时间**     | 快   | 中等      |
| **类型检查速度** | 快   | 中等      |

## 生态系统对比

| 功能         | Koka   | Effect-TS |
| ------------ | ------ | --------- |
| **核心功能** | ✅     | ✅        |
| **测试工具** | 基础   | 丰富      |
| **开发工具** | 基础   | 丰富      |
| **社区支持** | 成长中 | 成熟      |
| **文档质量** | 良好   | 优秀      |
| **示例项目** | 基础   | 丰富      |

## 结论

两个库都提供强大的效果管理，但有不同的权衡：

-   **Koka** 提供更简单、更专注的解决方案
-   **Effect-TS** 提供完整的效果管理工具包

就像 immer 和 immutable-js 的关系一样，Koka 是 Effect-TS 的极简替代方案，专注于提供核心效果管理功能，而无需完整生态系统的复杂性。
