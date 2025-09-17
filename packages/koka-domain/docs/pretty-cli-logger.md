# Pretty CLI Logger

美化的命令行日志记录器，用于格式化和显示 koka-domain 的执行树。

## 功能特性

### 🎨 视觉增强
- **树状结构显示**：使用 Unicode 字符绘制清晰的树状层级关系
- **彩色输出**：不同类型的操作使用不同颜色高亮
- **图标标识**：使用直观的 emoji 图标区分不同类型的操作
  - ⚡ 命令 (Command)
  - 🔍 查询 (Query)
  - ⏳ 异步操作
  - ✓ 成功返回
  - ✗ 错误返回
  - ∆ 状态变更
  - 📊 状态信息

### 📝 智能格式化
- **自动截断**：长字符串和大对象智能截断，保持输出整洁
- **数组摘要**：显示数组长度而非完整内容
- **对象摘要**：显示对象的前几个键名
- **深度限制**：可配置的最大嵌套深度，防止输出过长

### ⚙️ 可配置选项

```typescript
type LoggerOptions = {
    colors?: boolean        // 是否使用颜色（默认: true）
    timestamp?: boolean     // 是否显示时间戳（默认: true）
    showArgs?: boolean      // 是否显示参数（默认: true）
    showReturn?: boolean    // 是否显示返回值（默认: true）
    showStates?: boolean    // 是否显示状态（默认: false）
    showChanges?: boolean   // 是否显示变更（默认: true）
    maxDepth?: number      // 最大嵌套深度（默认: 10）
    compactMode?: boolean  // 紧凑模式（默认: false）
}
```

## 使用方法

### 基础用法

```typescript
import { Store } from './koka-domain'
import { PrettyLogger } from './pretty-cli-logger'

const store = new Store({
    state: initialState,
    enhancers: [
        PrettyLogger()  // 使用默认配置
    ]
})
```

### 自定义配置

```typescript
const store = new Store({
    state: initialState,
    enhancers: [
        PrettyLogger({
            compactMode: true,     // 启用紧凑模式
            showStates: true,      // 显示状态信息
            maxDepth: 5,          // 限制嵌套深度为 5
            timestamp: false      // 不显示时间戳
        })
    ]
})
```

## 输出示例

### 标准模式

```
[2024-01-20T10:30:45.123Z] ⚡ CMD TodoDomain.addTodo
  → Args: 
    [0]: "学习 TypeScript"
  ∆ Changes:
    Change [0]:
      Before: []
      After:  [{"id":"1705745445123","text":"学习 TypeScript","completed":false}]
  ✓ Return: {"id":"1705745445123","text":"学习 TypeScript","completed":false}
```

### 紧凑模式

```
⚡ CMD TodoDomain.addTodo
  → Args: "学习 TypeScript"
  ∆ Changes:
    [0]: [] → [{"id":"1705745445123","text":"...
  ✓ Return: {"id":"1705745445123","text":"学习 TypeScript","completed":false}
```

### 嵌套结构

```
⚡ CMD AppDomain.clearCompleted ⏳
  🔎 Queries (1):
  └─🔍 QRY TodoDomain.getCompletedTodos
      ✓ Return: [{"id":"1","text":"已完成任务","completed":true}]
  📁 Sub-Commands (1):
  └─⚡ CMD TodoDomain.deleteTodo
      → Args: "1"
      ∆ Changes:
        [0]: [{"id":"1","text":"已完成任务","completed":true}] → []
      ✓ Return: undefined
```

## 高级功能

### 值格式化策略

1. **基础类型**：直接显示
2. **字符串**：超过最大长度时截断并添加省略号
3. **数组**：显示 `[Array(长度)]` 格式
4. **对象**：显示前 3 个键名，超出部分用省略号表示
5. **错误**：特殊标记并使用红色显示

### 树状结构绘制

使用 Unicode Box Drawing 字符：
- `│` 垂直线：表示层级继续
- `├` 分支：表示非最后一个子节点
- `└` 末尾分支：表示最后一个子节点
- `─` 水平线：连接节点

### 性能优化

- **深度限制**：防止过深的嵌套导致性能问题
- **智能截断**：避免输出过长的数据
- **延迟渲染**：仅在需要时格式化数据

## 最佳实践

1. **生产环境**：考虑禁用颜色输出或使用更简洁的配置
2. **调试模式**：启用 `showStates` 查看详细状态信息
3. **性能敏感**：使用 `compactMode` 减少输出量
4. **深层嵌套**：适当调整 `maxDepth` 避免输出过长

## 扩展和自定义

可以基于 `formatExecutionTree` 函数创建自定义格式化器：

```typescript
import { ExecutionTree } from './koka-domain'

function myCustomFormatter(tree: ExecutionTree): string {
    // 自定义格式化逻辑
    return formatExecutionTree(tree, {
        // 自定义选项
    })
}
```

## 故障排除

### 问题：输出中没有颜色
- 检查终端是否支持颜色
- 确认 `colors` 选项设置为 `true`
- 某些 CI/CD 环境可能需要额外配置

### 问题：输出太长
- 减小 `maxDepth` 值
- 启用 `compactMode`
- 禁用不必要的选项（如 `showStates`）

### 问题：特殊字符显示异常
- 确保终端使用 UTF-8 编码
- 某些 Windows 终端可能需要额外配置才能正确显示 Unicode 字符