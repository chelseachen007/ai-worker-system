# 功能规格: Skill 自动发现与生成工具

> 涉及项目: backend
> 反馈ID: 20260128-113059-fw44a

## 原始需求
```
做一个 skill，当任务遇到需要处理一件事前，先去 skills 里找，找不到去 github 找高 star 的项目，然后生成一份 skill，方便下次复用
```

## 功能目标

- **自动技能检索**: 在执行任务前自动检索现有 skills 目录中是否有可复用技能
- **GitHub 项目搜索**: 当本地无匹配技能时，自动从 GitHub 搜索高星同类项目
- **Skill 模板生成**: 基于找到的 GitHub 项目自动生成新的 skill 模板供下次复用

## 验收标准

- [ ] AC-01: 能够根据任务关键词在 skills 目录中进行模糊匹配搜索
- [ ] AC-02: 能够调用 GitHub API 按星标数排序搜索相关开源项目
- [ ] AC-03: 生成的 skill 模板符合项目规范且可直接使用
- [ ] AC-04: 支持技能的索引和缓存，避免重复搜索

## 技术要点

### 1. Skills 目录结构
```
skills/
├── index.json          # 技能索引
├── templates/          # 模板目录
│   └── skill-template.md
└── [category]/
    └── [skill-name].md
```

### 2. GitHub 搜索策略
- 使用 GitHub Search API
- 筛选条件：stars:>1000, 按最佳匹配排序
- 优先选择 MIT/Apache 许可证

### 3. Skill 生成流程
```
任务输入 → 本地搜索 → GitHub搜索 → 提取关键信息 → 生成Skill
                ↓              ↓
            命中返回     未命中继续
```

## 编码原则

- 提前终止（Early Termination Principle）
- 组合优于继承
- 偏好纯函数，非必要不使用 class
- 遵循 constitution.md 架构约束

## 待澄清问题

1. **skills 目录位置**：
   - 项目根目录下的 ./skills/ 文件夹
   - 用户配置目录 (~/.claude/skills/)
   - 其他位置

2. **GitHub 搜索筛选条件**：
   - 星标数 > 1000，按相关性排序
   - 星标数 > 5000，按星标数排序
   - 仅搜索特定语言的项目

3. **工具工作形式**：
   - 独立 skill，用户手动调用
   - 自动拦截器，每次任务前触发
   - Claude Code 内置功能增强
