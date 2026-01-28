/**
 * Spec 生成器
 * 将用户输入转换为 spec.md
 */

export interface SpecGeneratorInput {
  feedbackId: string;
  description: string;
  summary?: {
    summary?: string;
    goals: string[];
    acceptanceCriteria: string[];
    ambiguity: string[];
  };
  projectScope: 'backend' | 'frontend' | 'fullstack';
}

const PROJECT_SCOPE_LABELS: Record<string, string> = {
  backend: '后端项目',
  frontend: '前端项目',
  fullstack: '全栈（前后端）',
};

/**
 * 生成 spec.md 内容
 */
export function generateSpecContent(input: SpecGeneratorInput): string {
  const { feedbackId, description, summary, projectScope } = input;
  const lines: string[] = [];

  // Header
  const title = summary?.summary || description;
  lines.push(`# 功能规格: ${title}`);
  lines.push('');
  lines.push(`> 涉及项目: ${PROJECT_SCOPE_LABELS[projectScope]}`);
  lines.push(`> 反馈ID: ${feedbackId}`);
  lines.push('');

  // 原始需求
  lines.push('## 原始需求');
  lines.push('```');
  lines.push(description);
  lines.push('```');
  lines.push('');

  // Goals
  if (summary?.goals?.length) {
    lines.push('## 功能目标');
    summary.goals.forEach((goal) => lines.push(`- ${goal}`));
    lines.push('');
  }

  // Acceptance Criteria
  if (summary?.acceptanceCriteria?.length) {
    lines.push('## 验收标准');
    summary.acceptanceCriteria.forEach((criteria, idx) => {
      lines.push(`- [ ] AC-${String(idx + 1).padStart(2, '0')}: ${criteria}`);
    });
    lines.push('');
  }

  // 编码原则
  lines.push('## 编码原则');
  lines.push('- 提前终止（Early Termination Principle）');
  lines.push('- 组合优于继承');
  lines.push('- 偏好纯函数，非必要不使用 class');
  lines.push('- 遵循 constitution.md 架构约束');
  lines.push('- 错误处理优先使用 Result 类型而非异常');
  lines.push('');

  // 不做什么
  if (summary?.ambiguity?.length) {
    lines.push('## 待澄清点');
    summary.ambiguity.forEach((point, idx) => {
      lines.push(`${idx + 1}. ${point}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 生成 Plan Prompt
 */
export function buildPlanPrompt(
  specContent: string,
  constitutionContent: string,
  projectScope: string
): string {
  const lines: string[] = [];

  lines.push('你是 SDD (Spec-Driven Development) 实施规划助手。');
  lines.push('');

  // 明确项目范围
  if (projectScope === 'fullstack') {
    lines.push('## 重要提示');
    lines.push('此需求涉及 **前后端两个项目**，必须同时规划：');
    lines.push('');
    lines.push('| 项目 | 说明 |');
    lines.push('|------|------|');
    lines.push('| 后端 | 遵循 storage/constitution/backend.md 约束 |');
    lines.push('| 前端 | 遵循 storage/constitution/frontend.md 约束 |');
    lines.push('');
  }

  lines.push('## 规格说明');
  lines.push(specContent);
  lines.push('');

  lines.push('## 架构约束 (Constitution)');
  lines.push(constitutionContent);
  lines.push('');

  lines.push('## 输出要求');
  lines.push('请输出完整的技术方案，包含以下部分：');
  lines.push('');
  lines.push('### 1. 技术方案概述');
  lines.push('简要描述实现思路和技术选型。');
  lines.push('');
  lines.push('### 2. 涉及的文件和模块');
  lines.push('- 需要修改的现有文件');
  lines.push('- 需要新建的文件');
  lines.push('- 各文件的职责');
  lines.push('');
  lines.push('### 3. 关键实现步骤');
  lines.push('按顺序列出实现步骤，每步应该是：');
  lines.push('- 独立可验证的');
  lines.push('- 30分钟内可完成');
  lines.push('- 有明确的输入输出');
  lines.push('');
  lines.push('### 4. 风险点与缓解措施');
  lines.push('- 可能的兼容性问题');
  lines.push('- 性能考虑');
  lines.push('- 数据一致性');
  lines.push('');
  lines.push('### 5. 测试策略');
  lines.push('- 单元测试要点');
  lines.push('- 集成测试场景');
  lines.push('- 手动验证步骤');

  return lines.join('\n');
}

/**
 * 生成 Tasks Prompt
 */
export function buildTasksPrompt(
  specContent: string,
  planContent: string
): string {
  const lines: string[] = [];

  lines.push('基于以下规格说明和技术方案，拆解可执行任务。');
  lines.push('');

  lines.push('## 规格说明');
  lines.push(specContent);
  lines.push('');

  lines.push('## 技术方案');
  lines.push(planContent);
  lines.push('');

  lines.push('## 输出要求');
  lines.push('必须输出且仅输出一个 JSON 对象：');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "tasks": [');
  lines.push('    {');
  lines.push('      "id": "task-1",');
  lines.push('      "title": "任务描述",');
  lines.push('      "description": "详细描述任务内容",');
  lines.push('      "files": ["涉及的文件路径"],');
  lines.push('      "dependsOn": [],');
  lines.push('      "project": "backend"');
  lines.push('    }');
  lines.push('  ]');
  lines.push('}');
  lines.push('```');
  lines.push('');

  lines.push('## 约束条件');
  lines.push('');
  lines.push('- `id`: 任务标识，格式为 task-N（N 从 1 开始）');
  lines.push('- `title`: 简洁的任务标题');
  lines.push('- `description`: 详细的任务描述，包含具体要做什么');
  lines.push('- `files`: 涉及的文件路径数组');
  lines.push('- `dependsOn`: 依赖的任务 ID 数组，空数组表示无依赖');
  lines.push('- `project`: 必填，任务所属项目（backend/frontend）');
  lines.push('- 每个任务应在 30 分钟内可完成');
  lines.push('- 同项目的任务按依赖顺序排列');
  lines.push('- 前后端任务可以并行执行');
  lines.push('');

  return lines.join('\n');
}

/**
 * 从 AI 响应中提取 JSON
 */
export function extractTasksJSON(response: string): string | null {
  // 尝试找到第一个 ```json ``` 代码块
  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = response.match(jsonBlockRegex);
  if (match?.[1]) {
    return match[1].trim();
  }

  // 尝试找到第一个 ``` ``` 代码块
  const codeBlockRegex = /```\s*([\s\S]*?)\s*```/;
  const codeMatch = response.match(codeBlockRegex);
  if (codeMatch?.[1]) {
    const content = codeMatch[1].trim();
    // 检查是否是 JSON
    if (content.startsWith('{') || content.startsWith('[')) {
      return content;
    }
  }

  // 尝试直接解析整个响应
  const trimmed = response.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  return null;
}
