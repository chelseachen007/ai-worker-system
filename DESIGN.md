# 24h AI Worker System - 设计文档

## 1. 系统概述

### 1.1 目标
构建一个 AI Agent 调度系统，实现：
- 自动化处理用户反馈/需求
- 规模化执行 AI 编程任务
- 完整的执行留痕和复盘能力
- 多 AI 后端支持与失败切换

### 1.2 核心价值
| 问题 | 解决方案 |
|------|----------|
| 手动管理 4-6 个 AI 终端达到极限 | 调度层自动分发任务 |
| 执行过程无留痕，难以复盘 | SDD 文档完整记录每一步 |
| AI 工具配额耗尽导致中断 | 自动切换备用工具 |
| 同项目任务冲突 | 组间并发、组内串行 |

### 1.3 系统边界
```
用户反馈 → [Clarification] → [SDD 流程] → [任务执行] → 通知用户
           需求澄清          规划阶段      执行阶段
```

---

## 2. 核心概念

### 2.1 SDD（Spec-Driven Development）
每个需求处理完成后生成一组文档：

```
storage/feedbacks/2026-01-27/20260127-143021-a1b2c3/
├── sdd/
│   ├── spec.md      # 功能规格：目标、验收标准
│   ├── plan.md      # 技术方案：涉及文件、实现步骤
│   └── tasks.md     # 任务清单：每个任务的描述和状态
├── tasks.json       # 任务执行状态（供程序读取）
└── debug/
    ├── prompts/     # 每一步的 prompt
    └── agent.log    # 执行日志
```

### 2.2 两阶段流程

#### Clarification（需求澄清）
- **目的**：判断需求是否清晰，不清晰则生成澄清问题
- **输入**：用户原始反馈
- **输出**：结构化摘要 + 澄清问题（如有）

#### Feedback（需求开发）
- **目的**：完整的 SDD 流程执行
- **流程**：spec → plan → tasks → execute
- **输出**：完成的代码 + SDD 文档

### 2.3 项目范围
- `backend`：后端项目任务
- `frontend`：前端项目任务
- `fullstack`：全栈任务（同时涉及前后端）

---

## 3. 架构设计

### 3.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户层                                    │
│  CLI / Web Interface / 企业微信通知                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       调度层 (Scheduler)                         │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────┐    │
│  │ 任务队列管理 │  │  状态机管理       │  │  并发控制        │    │
│  └─────────────┘  └──────────────────┘  └─────────────────┘    │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
┌──────────────────────┐      ┌──────────────────────┐
│ Clarification Handler │      │ Feedback Handler     │
│ - 需求清晰度判断      │      │ - Spec 生成器        │
│ - 澄清问题生成        │      │ - Plan 生成器        │
│ - 用户确认处理        │      │ - Tasks 拆解器       │
└──────────────────────┘      │ - 任务执行器          │
                              └──────────┬───────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │  AI CLI 适配器        │
                              │ - Claude Code        │
                              │ - Gemini CLI         │
                              │ - Codex CLI          │
                              └──────────────────────┘
```

### 3.2 技术选型

| 组件 | 方案 | 理由 |
|------|------|------|
| 语言/运行时 | TypeScript + Node.js | 类型安全，生态成熟 |
| 任务存储 | 文件系统 | 可读、可 Git 版本化、方便调试 |
| 任务调度 | 轮询 | 简单可靠，无分布式一致性问题 |
| AI 调用 | CLI 工具 | 支持多后端切换，内置代码操作能力 |
| 状态管理 | JSON 文件 | 单一数据源，状态流转清晰 |
| CLI 框架 | Commander.js | 成熟的 Node.js CLI 框架 |
| 日志 | Pino | 高性能结构化日志 |

**不使用**：消息队列、数据库、Redis、LangChain

---

## 4. 数据结构设计

### 4.1 文件存储结构

```
ai-worker-system/
├── src/                    # 源代码
├── storage/                # 数据存储
│   ├── feedbacks/          # 用户反馈
│   │   └── 2026-01-27/     # 按日期分区
│   │       └── {feedback-id}/
│   │           ├── sdd/
│   │           ├── tasks.json
│   │           └── debug/
│   ├── constitution/       # 架构约束文档
│   │   └── project-constitution.md
│   └── agent-status/       # Agent 运行状态
│       └── status.json
├── config/                 # 配置文件
│   ├── projects.json       # 项目配置
│   └── tools.json          # AI 工具配置
└── logs/                   # 运行日志
```

### 4.2 核心数据类型

#### Feedback（用户反馈）
```typescript
interface Feedback {
  id: string                    // 格式: YYYYMMDD-HHMMSS-abc123
  type: 'clarification' | 'feedback'
  status: ClarificationStatus | FeedbackStatus
  userInput: string             // 用户原始输入
  createdAt: string             // ISO timestamp
  updatedAt: string             // ISO timestamp
  projectScope: 'backend' | 'frontend' | 'fullstack'
}
```

#### Clarification（需求澄清）
```typescript
type ClarificationStatus =
  | 'pending'       // 等待 AI 分析
  | 'processing'    // AI 正在分析
  | 'awaiting'      // 等待用户确认
  | 'confirmed'     // 用户已确认
  | 'cancelled'     // 用户取消
  | 'expired'       // 超时过期
  | 'failed'        // 处理失败

interface Clarification extends Feedback {
  type: 'clarification'
  status: ClarificationStatus
  summary?: {
    goals: string[]              // 功能目标
    acceptanceCriteria: string[] // 验收标准
    ambiguity: string[]          // 模糊点描述
  }
  questions?: ClarificationQuestion[]  // 待确认问题
}

interface ClarificationQuestion {
  id: string
  question: string
  options: string[]
  required: boolean
}
```

#### Feedback（需求开发）
```typescript
type FeedbackStatus =
  | 'pending'       // 等待开始
  | 'analyzing'     // 生成 spec/plan/tasks
  | 'executing'     // 执行任务中
  | 'completed'     // 执行完成
  | 'failed'        // 执行失败

interface FeedbackExecution extends Feedback {
  type: 'feedback'
  status: FeedbackStatus
  summary?: ClarificationSummary
  sdd?: {
    spec: string      // spec.md 内容
    plan: string      // plan.md 内容
    tasks: ExecutableTask[]
  }
}
```

#### ExecutableTask（可执行任务）
```typescript
interface ExecutableTask {
  id: string                    // task-1, task-2, ...
  title: string                 // 任务标题
  description: string           // 详细描述
  files: string[]               // 涉及的文件
  project: 'backend' | 'frontend'
  dependsOn: string[]           // 依赖的任务 ID
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  result?: {
    exitCode: number
    output: string
    duration: number
  }
}
```

#### ToolStatus（AI 工具状态）
```typescript
interface ToolStatus {
  name: string                  // claude, gemini, codex
  available: boolean
  lastSuccess?: number          // timestamp
  lastFailed?: number           // timestamp
  responseTimeMs?: number       // 平均响应时间
  failureCount: number
}
```

### 4.3 状态流转

#### Clarification 状态机
```
pending → processing → awaiting → confirmed → (转为 Feedback)
                    ↘          ↗
                   failed   cancelled
                    ↘          ↗
                    expired ←──┘
```

#### Feedback 状态机
```
pending → analyzing → executing → completed
           ↘           ↘
           failed ←─────┘
```

---

## 5. 核心模块设计

### 5.1 调度器 (Scheduler)
**职责**：
- 轮询任务队列
- 分发任务到对应 Handler
- 管理任务优先级

**接口**：
```typescript
interface Scheduler {
  start(): void
  stop(): void
  poll(): Promise<void>
  dispatch(feedback: Feedback): Promise<void>
}
```

### 5.2 Clarification Handler
**职责**：
- 分析用户输入清晰度
- 生成澄清问题
- 处理用户确认

**流程**：
```
1. 读取 pending 状态的 clarification
2. 调用 AI 分析输入
3. 生成 summary 和 questions（如有）
4. 状态转为 awaiting，通知用户
5. 用户确认后，转为 confirmed
6. 创建对应的 feedback 记录
```

### 5.3 Spec 生成器
**职责**：将用户输入转换为 spec.md

**Prompt 模板**：
```typescript
const generateSpecContent = (input: SpecGeneratorInput): string => {
  const { feedbackId, description, summary, projectScope } = input
  return `# 功能规格: ${summary.summary || description}

> 涉及项目: ${PROJECT_SCOPE_LABELS[projectScope]}

## 功能目标
${summary.goals?.map(g => `- ${g}`).join('\n')}

## 验收标准
${summary.acceptanceCriteria?.map((c, i) => `- [ ] AC-${i+1}: ${c}`).join('\n')}

## 编码原则
- 提前终止（Early Termination Principle）
- 组合优于继承
- 偏好纯函数，非必要不使用 class
- 遵循 constitution.md 架构约束
`
}
```

### 5.4 Plan 生成器
**职责**：基于 spec.md 和 constitution.md 生成技术方案

**Prompt 模板**：
```typescript
const buildPlanPrompt = (
  specContent: string,
  constitutionContent: string,
  projectScope: string
): string => {
  return `你是 SDD (Spec-Driven Development) 实施规划助手。

## 重要提示
此需求涉及 **${projectScope}** 项目

## 规格说明
${specContent}

## 架构约束 (Constitution)
${constitutionContent}

## 输出要求
1. 技术方案概述
2. 涉及的文件和模块
3. 关键实现步骤
4. 风险点与缓解措施
5. 测试策略
`
}
```

### 5.5 Tasks 拆解器
**职责**：将 plan.md 转换为结构化任务列表

**Prompt 模板**：
```typescript
const buildTasksPrompt = (specContent: string, planContent: string): string => {
  return `基于以下规格说明和技术方案，拆解可执行任务。

## 规格说明
${specContent}

## 技术方案
${planContent}

## 输出要求
必须输出且仅输出一个 JSON 对象：
{
  "tasks": [
    {
      "id": "task-1",
      "title": "任务描述",
      "files": ["涉及的文件路径"],
      "dependsOn": [],
      "project": "backend"
    }
  ]
}

约束：
- project 必填，标注任务所属项目（backend/frontend）
- 每个任务应在 30 分钟内可完成
- 任务间依赖通过 dependsOn 表达
`
}
```

### 5.6 任务执行器
**职责**：按并发策略执行任务

**并发策略**：
- **组间并发**：前后端任务并行执行
- **组内串行**：同项目任务按依赖顺序执行

```typescript
const executeTasks = async (tasks: ExecutableTask[]): Promise<boolean> => {
  const { backend, frontend } = groupTasksByProject(tasks)

  // 组间并发，组内串行
  const results = await Promise.all([
    backend.length > 0 ? executeTaskGroup(backend) : Promise.resolve(true),
    frontend.length > 0 ? executeTaskGroup(frontend) : Promise.resolve(true),
  ])

  return results.every(ok => ok)
}
```

### 5.7 AI CLI 适配器
**职责**：
- 调用 AI CLI 工具
- 失败自动切换
- 工具可用性探测

**失败切换机制**：
```typescript
const executeAgent = async (prompt: string): Promise<ExecuteResult> => {
  const toolPool = getOrderedToolPool()  // 按可用性排序
  const triedTools = new Set<string>()

  for (const tool of toolPool) {
    if (triedTools.has(tool)) continue

    const result = await runToolCommand(tool, prompt)
    triedTools.add(tool)

    if (result.exitCode === 0) {
      markSuccess(tool)
      return result
    }

    if (isQuotaError(result.output)) {
      markFailed(tool, 'quota exceeded')
    } else {
      markFailed(tool, `exit code ${result.exitCode}`)
    }
  }

  throw new Error('All tools failed')
}
```

**工具探测**：
```typescript
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000  // 5分钟冷却

const isToolAvailable = (status: ToolStatus): boolean => {
  if (!status.available) return false
  // 5分钟内失败过，暂时不可用
  if (status.lastFailed && Date.now() - status.lastFailed < FAILURE_COOLDOWN_MS) {
    return false
  }
  return true
}
```

---

## 6. 配置管理

### 6.1 项目配置 (config/projects.json)
```json
{
  "projects": {
    "backend": {
      "name": "后端项目",
      "path": "/path/to/backend",
      "constitutionPath": "storage/constitution/backend.md"
    },
    "frontend": {
      "name": "前端项目",
      "path": "/path/to/frontend",
      "constitutionPath": "storage/constitution/frontend.md"
    }
  }
}
```

### 6.2 AI 工具配置 (config/tools.json)
```json
{
  "tools": [
    {
      "name": "claude",
      "command": "claude",
      "args": ["--print"],
      "enabled": true
    },
    {
      "name": "gemini",
      "command": "gemini-cli",
      "args": ["-p"],
      "enabled": true
    },
    {
      "name": "codex",
      "command": "codex",
      "args": ["--non-interactive"],
      "enabled": false
    }
  ],
  "maxRetries": 3,
  "retryDelayMs": 1000
}
```

---

## 7. CLI 接口设计

### 7.1 命令结构
```bash
# 提交反馈/需求
ai-worker feedback "搜索结果分页有问题"

# 提交带项目范围的反馈
ai-worker feedback "API 性能优化" --scope backend

# 查看任务列表
ai-worker list

# 查看任务详情
ai-worker show <feedback-id>

# 确认澄清问题
ai-worker confirm <feedback-id>

# 启动调度器
ai-worker start

# 停止调度器
ai-worker stop

# 查看状态
ai-worker status
```

### 7.2 交互式确认界面
```
📋 需求澄清 - 20260127-143021-a1b2c3

原文: "搜索结果分页有问题"

AI 分析结果:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能目标:
  • 修复搜索结果分页切换后数据不更新的问题

验收标准:
  □ [ ] AC-01: 点击分页按钮后，列表数据刷新
  □ [ ] AC-02: URL 页码参数正确更新
  □ [ ] AC-03: 保持当前搜索条件

待确认问题:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 是否需要保留用户滚动位置？
   ○ 是，切换后回到顶部
   ● 否，保持滚动位置

2. 分页组件样式是否需要调整？
   ● 否，只修复功能
   ○ 是，需要统一样式

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[↑↓ 选择]  [Enter 确认]  [Esc 取消]
```

---

## 8. 实现计划

### 阶段一：基础架构 (Week 1)
- [ ] 项目初始化（TypeScript + Node.js）
- [ ] 文件存储结构实现
- [ ] 状态机定义
- [ ] 基础 CLI 框架

### 阶段二：Clarification 流程 (Week 1-2)
- [ ] Clarification Handler
- [ ] AI 分析集成
- [ ] 澄清问题生成
- [ ] 用户确认处理

### 阶段三：SDD 流程 (Week 2-3)
- [ ] Spec 生成器
- [ ] Plan 生成器
- [ ] Tasks 拆解器
- [ ] Constitution 管理

### 阶段四：执行引擎 (Week 3-4)
- [ ] AI CLI 适配器
- [ ] 失败切换机制
- [ ] 工具可用性探测
- [ ] 任务并发执行

### 阶段五：调度器 (Week 4)
- [ ] 任务队列轮询
- [ ] 任务分发逻辑
- [ ] 状态持久化

### 阶段六：用户界面 (Week 5)
- [ ] CLI 命令完善
- [ ] 交互式确认界面
- [ ] 进度查看
- [ ] 通知集成

### 阶段七：测试与优化 (Week 6)
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能优化
- [ ] 文档完善

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| AI 生成质量不稳定 | 任务执行失败 | Constitution 约束 + 人工审核关键路径 |
| 文件系统并发冲突 | 数据损坏 | 文件锁 + 原子写入 |
| CLI 工具配额耗尽 | 系统不可用 | 多工具池 + 失败切换 |
| 依赖任务判断错误 | 执行顺序错乱 | 显式依赖声明 + 轮询等待 |

---

## 10. 演进路线

### V1：最小可用版本
- 单项目支持
- 单 AI 工具
- 基础 SDD 流程

### V2：多项目支持
- 前后端分离
- 智能并发执行

### V3：规模化
- 多 AI 工具池
- 失败自动切换
- 工具可用性探测

### V4：自举能力
- 系统自我修复
- 系统自我迭代
- Constitution 自动更新

---

*文档版本: 1.0*
*最后更新: 2026-01-27*
