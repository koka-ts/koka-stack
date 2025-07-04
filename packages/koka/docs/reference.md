# Koka API 参考

本文档提供 Koka 库的完整 API 参考。

## Eff API

### 核心方法

#### `Eff.err(name).throw(error?)`

抛出错误效果。

**参数：**

-   `name` (string): 错误类型的名称
-   `error` (any, 可选): 错误信息

**返回：** `Generator<Err<Name, E>, never>`

**示例：**

```typescript
function* validateUser(userId: string) {
    if (!userId) {
        yield* Eff.err('ValidationError').throw('User ID is required')
    }
    return { id: userId, name: 'John Doe' }
}
```

#### `Eff.ctx(name).get<T>()`

获取上下文值。

**参数：**

-   `name` (string): 上下文名称
-   `T` (类型参数): 上下文值的类型

**返回：** `Generator<Ctx<Name, T>, T>`

**示例：**

```typescript
function* getUserInfo() {
    const userId = yield* Eff.ctx('UserId').get<string>()
    const apiKey = yield* Eff.ctx('ApiKey').get<string>()
    return { userId, apiKey }
}
```

#### `Eff.ctx(name).opt<T>()`

获取可选的上下文值。

**参数：**

-   `name` (string): 上下文名称
-   `T` (类型参数): 上下文值的类型

**返回：** `Generator<Opt<Name, T>, T | undefined>`

**示例：**

```typescript
function* getUserPreferences() {
    const theme = yield* Eff.ctx('Theme').opt<string>()
    const fontSize = yield* Eff.ctx('FontSize').opt<number>()
    return { theme: theme ?? 'light', fontSize: fontSize ?? 14 }
}
```

#### `Eff.await<T>(promise)`

处理异步操作。

**参数：**

-   `promise` (Promise<T> | T): Promise 或同步值

**返回：** `Generator<Async, T>`

**示例：**

```typescript
async function* fetchData() {
    const response = yield* Eff.await(fetch('/api/data'))
    return response.json()
}
```

#### `Eff.try(generator).handle(handlers)`

处理效果。

**参数：**

-   `generator` (Task<Yield, Return>): 生成器函数或生成器
-   `handlers` (Partial<EffectHandlers<Yield>>): 效果处理器

**返回：** `Task<Exclude<Yield, { name: keyof Handlers }>, Return | ExtractErrorHandlerReturn<Handlers, Yield>>`

**示例：**

```typescript
const result = Eff.run(
    Eff.try(getUser('123')).handle({
        ValidationError: (error) => ({ error }),
        UserNotFound: (error) => ({ error }),
        UserId: '123',
    }),
)
```

#### `Eff.run(generator)`

运行生成器。

**参数：**

-   `generator` (MaybeFunction<Generator<AnyOpt, Return>>): 生成器函数或生成器

**返回：** `Return` 或 `Promise<Return>`

**示例：**

```typescript
// 同步运行
const result = Eff.run(getUserPreferences())

// 异步运行
const result = await Eff.run(fetchData())
```

#### `Eff.runSync(generator)`

同步运行生成器。

**参数：**

-   `generator` (MaybeFunction<Generator<AnyOpt, Return>>): 生成器函数或生成器

**返回：** `Return`

**示例：**

```typescript
const result = Eff.runSync(getUserPreferences())
```

#### `Eff.runAsync(generator)`

异步运行生成器。

**参数：**

-   `generator` (MaybeFunction<Generator<Async | AnyOpt, Return>>): 生成器函数或生成器

**返回：** `Promise<Return>`

**示例：**

```typescript
const result = await Eff.runAsync(fetchData())
```

### 效果组合方法

#### `Eff.combine(inputs)`

组合多个效果。

**参数：**

-   `inputs` (T): 数组或对象形式的输入

**返回：** `Generator<ExtractYield<T> | Async, ExtractReturn<T>>`

**示例：**

```typescript
// 数组形式
const [user, orders] = yield * Eff.combine([fetchUser(userId), fetchOrders(userId)])

// 对象形式
const result =
    yield *
    Eff.combine({
        user: fetchUser(userId),
        profile: fetchProfile(userId),
        settings: getDefaultSettings(),
    })
```

#### `Eff.all(inputs)`

并行执行所有效果并等待所有结果。

**参数：**

-   `inputs` (Iterable<Task<Yield, Return>>): 可迭代的效果列表

**返回：** `Generator<Yield | Async, Return[]>`

**示例：**

```typescript
const results = yield * Eff.all([fetchUser(userId), fetchProfile(userId), fetchOrders(userId)])
```

#### `Eff.race(inputs)`

并行执行效果并返回最快的结果。

**参数：**

-   `inputs` (Iterable<Task<Yield, Return>>): 可迭代的效果列表

**返回：** `Generator<Yield | Async, Return>`

**示例：**

```typescript
const result = yield * Eff.race([fetchFromCache(userId), fetchFromDatabase(userId), fetchFromAPI(userId)])
```

### 流式处理方法

#### `Eff.stream(inputs, handler)`

处理流式数据。

**参数：**

-   `inputs` (Iterable<Task<Yield, TaskReturn>>): 可迭代的效果列表
-   `handler` (StreamHandler<TaskReturn, HandlerReturn>): 流处理器函数

**返回：** `Generator<Async | Yield, HandlerReturn>`

**示例：**

```typescript
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

### 消息传递方法

#### `Eff.communicate(inputs)`

在生成器之间进行消息传递。

**参数：**

-   `inputs` (T): 包含生成器的对象

**返回：** `Generator<Exclude<ExtractYield<T>, { type: 'msg' }>, ExtractReturn<T>>`

**示例：**

```typescript
const result = Eff.runSync(
    Eff.communicate({
        sender: senderGenerator,
        receiver: receiverGenerator,
    }),
)
```

#### `Eff.msg(name).send(message)`

发送消息。

**参数：**

-   `name` (string): 消息名称
-   `message` (T): 消息内容

**返回：** `Generator<SendMsg<Name, T>, void>`

**示例：**

```typescript
yield * Eff.msg('Greeting').send('Hello, World!')
```

#### `Eff.msg(name).wait<T>()`

等待消息。

**参数：**

-   `name` (string): 消息名称
-   `T` (类型参数): 消息类型

**返回：** `Generator<WaitMsg<Name, T>, T>`

**示例：**

```typescript
const message = yield * Eff.msg('Greeting').wait<string>()
```

### 结果处理方法

#### `Eff.result(generator)`

将生成器转换为结果类型。

**参数：**

-   `generator` (Generator<Yield, Return>): 生成器

**返回：** `Generator<ExcludeErr<Yield>, Ok<Return> | ExtractErr<Yield>>`

**示例：**

```typescript
const result = Eff.run(Eff.result(getUser('123')))
if (result.type === 'ok') {
    console.log('User:', result.value)
} else {
    console.error('Error:', result.error)
}
```

#### `Eff.ok(generator)`

解包 Ok 结果。

**参数：**

-   `generator` (Generator<Yield, Return>): 返回 Result 类型的生成器

**返回：** `Generator<Yield | ExtractErr<Return>, InferOkValue<Return>>`

**示例：**

```typescript
const user = yield * Eff.ok(Eff.result(getUser('123')))
```

#### `Eff.runResult(generator)`

运行生成器并返回结果类型。

**参数：**

-   `generator` (MaybeFunction<Generator<Yield, Return>>): 生成器函数或生成器

**返回：** `Ok<Return> | ExtractErr<Yield>` 或 `Promise<Ok<Return> | ExtractErr<Yield>>`

**示例：**

```typescript
const result = await Eff.runResult(getUser('123'))
```

### 预定义效果类

#### `Eff.Err(name)<Error>`

创建错误效果类。

**参数：**

-   `name` (string): 错误类型名称
-   `Error` (类型参数): 错误数据类型

**返回：** 错误效果类

**示例：**

```typescript
class UserNotFound extends Eff.Err('UserNotFound')<string> {}
class ValidationError extends Eff.Err('ValidationError')<{ field: string; message: string }> {}

const error = new UserNotFound('User not found')
```

#### `Eff.Ctx(name)<Context>`

创建上下文效果类。

**参数：**

-   `name` (string): 上下文名称
-   `Context` (类型参数): 上下文数据类型

**返回：** 上下文效果类

**示例：**

```typescript
class DatabaseConnection extends Eff.Ctx('Database')<{ query: (sql: string) => Promise<any> }> {}
class Logger extends Eff.Opt('Logger')<(level: string, message: string) => void> {}

const db = new DatabaseConnection()
```

#### `Eff.Opt(name)<T>`

创建可选效果类。

**参数：**

-   `name` (string): 效果名称
-   `T` (类型参数): 数据类型

**返回：** 可选效果类

**示例：**

```typescript
class Theme extends Eff.Opt('Theme')<string> {}
class FontSize extends Eff.Opt('FontSize')<number> {}

const theme = new Theme()
```

#### `Eff.Msg(name)<T>`

创建消息效果类。

**参数：**

-   `name` (string): 消息名称
-   `T` (类型参数): 消息数据类型

**返回：** 消息效果类

**示例：**

```typescript
class UserRequest extends Eff.Msg('UserRequest')<{ userId: string }> {}
class UserResponse extends Eff.Msg('UserResponse')<{ user: any }> {}

const request = new UserRequest({ userId: '123' })
```

### 效果操作方法

#### `Eff.throw(err)`

抛出预定义的错误效果。

**参数：**

-   `err` (Err): 错误效果实例

**返回：** `Generator<E, never>`

**示例：**

```typescript
class UserNotFound extends Eff.Err('UserNotFound')<string> {}

function* getUser(userId: string) {
    if (!user) {
        yield* Eff.throw(new UserNotFound(`User ${userId} not found`))
    }
    return user
}
```

#### `Eff.get(ctx)`

从预定义上下文获取值。

**参数：**

-   `ctx` (Ctx | (new () => C)): 上下文类或实例

**返回：** `Generator<C, CtxValue<C>>`

**示例：**

```typescript
class DatabaseConnection extends Eff.Ctx('Database')<{ query: (sql: string) => Promise<any> }> {}

function* getUser(userId: string) {
    const db = yield* Eff.get(DatabaseConnection)
    return yield* Eff.await(db.query(`SELECT * FROM users WHERE id = '${userId}'`))
}
```

## 效果类型

### 基础类型

#### `Err<Name, T>`

错误效果类型。

```typescript
type Err<Name extends string, T> = {
    type: 'err'
    name: Name
    error: T
}
```

#### `Ctx<Name, T>`

上下文效果类型。

```typescript
type Ctx<Name extends string, T> = {
    type: 'ctx'
    name: Name
    context: EffSymbol | T
    optional?: true
}
```

#### `Opt<Name, T>`

可选效果类型。

```typescript
interface Opt<Name extends string, T> extends Ctx<Name, T> {
    optional: true
}
```

#### `Async`

异步效果类型。

```typescript
type Async = {
    type: 'async'
    name?: undefined
    promise: Promise<unknown>
}
```

#### `Msg<Name, T>`

消息效果类型。

```typescript
type Msg<Name extends string, T> = {
    type: 'msg'
    name: Name
    message?: T
}
```

### 组合类型

#### `AnyErr`

任意错误效果类型。

```typescript
type AnyErr = Err<string, any>
```

#### `AnyCtx`

任意上下文效果类型。

```typescript
type AnyCtx = Ctx<string, any>
```

#### `AnyOpt`

任意可选效果类型。

```typescript
type AnyOpt = Opt<string, any>
```

#### `AnyMsg`

任意消息效果类型。

```typescript
type AnyMsg = Msg<string, any>
```

#### `AnyEff`

任意效果类型。

```typescript
type AnyEff = Err<string, any> | Ctx<string, any> | Opt<string, any> | Async | Msg<string, any>
```

## Result 类型

### 基础类型

#### `Ok<T>`

成功结果类型。

```typescript
type Ok<T> = {
    type: 'ok'
    value: T
}
```

#### `Result<T, E>`

结果联合类型。

```typescript
type Result<T, E> = Ok<T> | (E extends AnyErr ? E : never)
```

### Result 工具函数

#### `Result.ok(value)`

创建成功结果。

**参数：**

-   `value` (T): 成功值

**返回：** `Ok<T>`

**示例：**

```typescript
const success = Result.ok(42)
```

#### `Result.err(name, error)`

创建错误结果。

**参数：**

-   `name` (Name): 错误名称
-   `error` (T): 错误信息

**返回：** `Err<Name, T>`

**示例：**

```typescript
const error = Result.err('ValidationError', 'Invalid input')
```

## 工具函数

### `isGenerator(value)`

检查值是否为生成器。

**参数：**

-   `value` (unknown): 要检查的值

**返回：** `boolean`

**示例：**

```typescript
function* gen() {}
const notGen = () => {}

console.log(isGenerator(gen())) // true
console.log(isGenerator(notGen())) // false
```

## 类型工具

### `Task<Yield, Return>`

任务类型，可以是生成器或生成器函数。

```typescript
type Task<Yield extends AnyEff, Return> = Generator<Yield, Return> | (() => Generator<Yield, Return>)
```

### `MaybePromise<T>`

可能是 Promise 的类型。

```typescript
type MaybePromise<T> = T extends Promise<any> ? T : T | Promise<T>
```

### `MaybeFunction<T>`

可能是函数的类型。

```typescript
type MaybeFunction<T> = T | (() => T)
```

### `StreamResult<T>`

流结果类型。

```typescript
type StreamResult<T> = {
    index: number
    value: T
}
```

### `StreamResults<TaskReturn>`

流结果异步生成器类型。

```typescript
type StreamResults<TaskReturn> = AsyncGenerator<StreamResult<TaskReturn>, void, void>
```

### `StreamHandler<TaskReturn, HandlerReturn>`

流处理器类型。

```typescript
type StreamHandler<TaskReturn, HandlerReturn> = (results: StreamResults<TaskReturn>) => Promise<HandlerReturn>
```
