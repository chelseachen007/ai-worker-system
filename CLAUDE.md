# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

24h AI Worker System 是一个 AI Agent 调度系统，实现自动化处理用户反馈/需求、规模化执行 AI 编程任务、完整的执行留痕和复盘能力。

## 核心命令

### 开发命令
```bash
npm run build      # TypeScript 编译到 dist/
npm run dev        # 监听模式编译（tsc --watch）
npm test           # 运行 vitest 测试
npm run lint       # ESLint 代码检查
npm run format     # Prettier 格式化
```

### CLI 命令
```bash
ai-worker feedback "<message>"        # 提交反馈/需求
ai-worker feedback "<msg>" --scope backend  # 指定项目范围
ai-worker list                        # 查看反馈列表
ai-worker show <feedback-id>          # 查看详情
ai-worker confirm <feedback-id>       # 确认澄清问题
ai-worker start [--daemon]            # 启动调度器
ai-worker stop                        # 停止调度器
ai-worker status                      # 查看系统状态
ai-worker claude-test [prompt]        # 测试 Claude CLI 集成
```

## 系统架构

### SDD 流程（Spec-Driven Development）
系统采用两阶段处理流程：

1. **Clarification（需求澄清）**：判断需求清晰度，生成澄清问题（如有歧义）
2. **Feedback（需求开发）**：完整的 SDD 流程 `spec → plan → tasks → execute`

### 目录结构
```
src/
├── cli/              # CLI 入口和命令定义
├── core/             # 调度器、状态机
├── handlers/         # Clarification/Feedback 处理器
├── generators/       # SDD 文档生成器（spec/plan/tasks）
├── executors/        # AI CLI 适配器、任务执行器
├── storage/          # 文件系统存储层
├── types/            # TypeScript 类型定义
└── utils/            # 辅助函数

storage/
├── feedbacks/        # 按日期分区的反馈数据
├── constitution/     # 项目架构约束文档
└── agent-status/     # AI 工具运行状态

config/
├── projects.json     # 项目配置
└── tools.json        # AI 工具配置
```

### 核心模块

**调度器（Scheduler）**：轮询任务队列，分发到 Handler，管理并发数

**Clarification Handler**：分析用户输入，判断是否需要澄清，生成澄清问题

**Feedback Handler**：执行 SDD 流程，生成 spec/plan/tasks，调用任务执行器

**AI CLI 适配器（aiAdapter）**：
- 支持多 AI 工具（claude/gemini/cursor）
- 自动失败切换（配额耗尽/失败时切换）
- 工具可用性探测（失败后 5 分钟冷却期）

**任务执行器（TaskExecutor）**：
- 组间并发（前后端任务并行）
- 组内串行（同项目任务按依赖顺序执行）

### 状态流转

**Clarification**: `pending → processing → awaiting → confirmed → (转为 Feedback)`

**Feedback**: `pending → analyzing → executing → completed`

### 并发策略
- 前后端任务可并行执行
- 同项目内任务按 `dependsOn` 依赖顺序串行执行

## 开发注意事项

### TypeScript 配置
- ES Module (`"type": "module"`)
- 路径别名：`@/*` 映射到 `src/*`
- 严格模式开启，`noUnusedLocals`、`noImplicitReturns` 等检查

### 文件系统存储
- 反馈按日期分区：`storage/feedbacks/YYYY-MM-DD/{feedback-id}/`
- SDD 文档存储在 `sdd/` 子目录
- 调试信息（prompts/responses/logs）存储在 `debug/` 子目录
- 使用原子写入（临时文件 + rename）

### Constitution 文档
位于 `storage/constitution/`，包含项目架构约束，AI 生成 plan 时会参考这些约束。

### AI CLI 调用
使用 `aiAdapter.execute(prompt, options)` 而非直接调用 CLI，支持：
- `preferredTool`: 指定工具
- `cwd`: 工作目录
- `timeout`: 超时时间
