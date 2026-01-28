# AI Worker System

24h AI Worker System - AI Agent 调度系统

## 功能特性

- 自动化处理用户反馈/需求
- SDD（Spec-Driven Development）流程
- 多 AI 后端支持与失败切换
- 智能并发执行（组间并发、组内串行）
- 完整的执行留痕和复盘能力

## 安装

```bash
npm install
npm run build
```

## 使用

```bash
# 查看帮助
ai-worker --help

# 提交反馈
ai-worker feedback "搜索结果分页有问题"

# 查看任务列表
ai-worker list

# 启动调度器
ai-worker start
```

## 开发

```bash
# 开发模式（监听文件变化）
npm run dev

# 运行测试
npm test

# 代码检查
npm run lint
```

## 项目结构

```
├── src/
│   ├── cli/              # CLI 命令
│   ├── core/             # 核心模块
│   ├── handlers/         # 处理器
│   ├── generators/       # SDD 生成器
│   ├── executors/        # 执行器
│   ├── storage/          # 存储层
│   └── types/            # 类型定义
├── storage/              # 数据存储
├── config/               # 配置文件
└── logs/                 # 日志文件
```

## 设计文档

详见 [DESIGN.md](./DESIGN.md)
