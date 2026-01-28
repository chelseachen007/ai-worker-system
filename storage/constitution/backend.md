# 后端项目架构约束

## 技术栈
- Node.js + TypeScript
- Express.js
- Prisma ORM

## 架构原则

### 1. 提前终止原则 (Early Termination)
函数应该在错误条件出现时尽早返回，避免深层嵌套。

```typescript
// 好的做法
function process(data: ProcessData): Result {
  if (!data) return { error: 'No data' }
  if (!isValid(data)) return { error: 'Invalid data' }
  // 继续处理...
}

// 避免
function process(data: ProcessData): Result {
  if (data) {
    if (isValid(data)) {
      // 深层嵌套的处理逻辑
    } else {
      return { error: 'Invalid data' }
    }
  } else {
    return { error: 'No data' }
  }
}
```

### 2. 组合优于继承
使用函数组合和对象组合，而不是类继承。

### 3. 纯函数优先
不修改输入参数，无副作用，相同输入产生相同输出。

### 4. 错误处理
- 使用 Result 类型而非异常
- 明确区分业务错误和系统错误

### 5. 模块组织
```
src/
├── routes/       # 路由定义
├── controllers/  # 控制器
├── services/     # 业务逻辑
├── models/       # 数据模型
└── utils/        # 工具函数
```

## 禁止事项
- 禁止在循环中执行数据库查询
- 禁止硬编码配置，使用环境变量
- 禁止在服务层直接访问请求/响应对象
