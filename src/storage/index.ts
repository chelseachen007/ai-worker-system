import type {
  AnyFeedback,
  Clarification,
  Feedback,
  ExecutableTask,
  ToolStatus,
  ProjectsConfig,
  ToolsConfig,
} from '../types/index.js';
import {
  getFeedbacksDir,
  getSDDDir,
  getPromptsDir,
  getDebugDir,
  ensureDir,
  readJSON,
  writeJSON,
  readText,
  writeText,
  appendText,
  listDir,
} from './filesystem.js';

/**
 * 生成唯一反馈 ID
 * 格式: YYYYMMDD-HHMMSS-随机字符
 */
export function generateFeedbackId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.random().toString(36).substring(2, 7);
  return `${date}-${time}-${random}`;
}

/**
 * 获取今天的日期字符串
 */
export function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 解析反馈 ID，提取日期
 */
export function parseFeedbackDate(feedbackId: string): string {
  const datePart = feedbackId.split('-')[0];
  return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
}

/**
 * 保存反馈
 */
export async function saveFeedback(feedback: AnyFeedback): Promise<void> {
  const date = parseFeedbackDate(feedback.id);
  const dir = getFeedbacksDir(date, feedback.id);
  await ensureDir(dir);

  const filePath = `${dir}/feedback.json`;
  await writeJSON(filePath, feedback);
}

/**
 * 读取反馈
 */
export async function loadFeedback(
  feedbackId: string
): Promise<AnyFeedback | null> {
  const date = parseFeedbackDate(feedbackId);
  const filePath = getFeedbacksDir(date, feedbackId, 'feedback.json');

  return await readJSON<AnyFeedback>(filePath);
}

/**
 * 列出指定日期的所有反馈
 */
export async function listFeedbacksByDate(date: string): Promise<AnyFeedback[]> {
  const dir = getFeedbacksDir(date);
  const entries = await listDir(dir);

  const feedbacks: AnyFeedback[] = [];
  for (const entry of entries) {
    const feedback = await loadFeedback(entry);
    if (feedback) {
      feedbacks.push(feedback);
    }
  }
  return feedbacks.sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
}

/**
 * 列出所有待处理的反馈
 */
export async function listPendingFeedbacks(): Promise<{
  clarifications: Clarification[];
  feedbacks: Feedback[];
}> {
  const today = getTodayDate();
  const feedbacks = await listFeedbacksByDate(today);

  const result = {
    clarifications: [] as Clarification[],
    feedbacks: [] as Feedback[],
  };

  for (const fb of feedbacks) {
    if (fb.type === 'clarification') {
      // 只返回待处理的任务（不包括已经在处理中的）
      if (fb.status === 'pending') {
        result.clarifications.push(fb as Clarification);
      }
    } else {
      if (fb.status === 'pending' || fb.status === 'analyzing') {
        result.feedbacks.push(fb as Feedback);
      }
    }
  }

  return result;
}

/**
 * 更新反馈状态
 */
export async function updateFeedbackStatus(
  feedbackId: string,
  newStatus: string
): Promise<boolean> {
  const feedback = await loadFeedback(feedbackId);
  if (!feedback) return false;

  (feedback as any).status = newStatus;
  feedback.updatedAt = new Date().toISOString();
  await saveFeedback(feedback);
  return true;
}

/**
 * 保存 SDD 文档
 */
export async function saveSDD(
  feedbackId: string,
  sdd: {
    spec: string;
    plan: string;
    tasks: ExecutableTask[];
  }
): Promise<void> {
  const date = parseFeedbackDate(feedbackId);
  const sddDir = getSDDDir(date, feedbackId);
  await ensureDir(sddDir);

  // 保存 spec.md
  await writeText(`${sddDir}/spec.md`, sdd.spec);

  // 保存 plan.md
  await writeText(`${sddDir}/plan.md`, sdd.plan);

  // 保存 tasks.md
  const tasksMd = generateTasksMarkdown(sdd.tasks);
  await writeText(`${sddDir}/tasks.md`, tasksMd);

  // 保存 tasks.json
  await writeJSON(`${sddDir}/tasks.json`, sdd.tasks);
}

/**
 * 读取 SDD 文档
 */
export async function loadSDD(feedbackId: string): Promise<{
  spec: string | null;
  plan: string | null;
  tasks: ExecutableTask[] | null;
}> {
  const date = parseFeedbackDate(feedbackId);
  const sddDir = getSDDDir(date, feedbackId);

  const [spec, plan, tasks] = await Promise.all([
    readText(`${sddDir}/spec.md`),
    readText(`${sddDir}/plan.md`),
    readJSON<ExecutableTask[]>(`${sddDir}/tasks.json`),
  ]);

  return { spec, plan, tasks };
}

/**
 * 生成 tasks.md 内容
 */
function generateTasksMarkdown(tasks: ExecutableTask[]): string {
  const lines: string[] = [];
  lines.push('# 任务清单\n');
  lines.push(`共 ${tasks.length} 个任务\n`);

  for (const task of tasks) {
    lines.push(`## ${task.id}: ${task.title}`);
    lines.push('');
    lines.push(`**项目**: ${task.project}`);
    lines.push('');
    lines.push(`**描述**: ${task.description}`);
    lines.push('');

    if (task.files.length > 0) {
      lines.push('**涉及文件**:');
      task.files.forEach((f) => lines.push(`  - ${f}`));
      lines.push('');
    }

    if (task.dependsOn.length > 0) {
      lines.push('**依赖**: ' + task.dependsOn.join(', '));
      lines.push('');
    }

    lines.push(`**状态**: ${task.status}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 保存 AI Prompt
 */
export async function savePrompt(
  feedbackId: string,
  step: string,
  prompt: string
): Promise<void> {
  const date = parseFeedbackDate(feedbackId);
  const promptsDir = getPromptsDir(date, feedbackId);
  await ensureDir(promptsDir);

  const timestamp = Date.now();
  await writeText(`${promptsDir}/${step}-${timestamp}.txt`, prompt);
}

/**
 * 保存 AI 响应
 */
export async function saveResponse(
  feedbackId: string,
  step: string,
  response: string
): Promise<void> {
  const date = parseFeedbackDate(feedbackId);
  const promptsDir = getPromptsDir(date, feedbackId);
  await ensureDir(promptsDir);

  const timestamp = Date.now();
  await writeText(`${promptsDir}/${step}-${timestamp}-response.txt`, response);
}

/**
 * 追加日志
 */
export async function appendLog(
  feedbackId: string,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info'
): Promise<void> {
  const date = parseFeedbackDate(feedbackId);
  const debugDir = getDebugDir(date, feedbackId);
  await ensureDir(debugDir);

  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  await appendText(`${debugDir}/agent.log`, logLine);
}

/**
 * 读取项目配置
 */
export async function loadProjectsConfig(): Promise<ProjectsConfig | null> {
  return await readJSON<ProjectsConfig>('config/projects.json');
}

/**
 * 读取工具配置
 */
export async function loadToolsConfig(): Promise<ToolsConfig | null> {
  return await readJSON<ToolsConfig>('config/tools.json');
}

/**
 * 读取工具状态
 */
export async function loadToolStatus(): Promise<ToolStatus[]> {
  return (await readJSON<ToolStatus[]>('storage/agent-status/status.json')) || [];
}

/**
 * 保存工具状态
 */
export async function saveToolStatus(status: ToolStatus[]): Promise<void> {
  await writeJSON('storage/agent-status/status.json', status);
}

/**
 * 更新单个工具状态
 */
export async function updateToolStatus(
  toolName: string,
  updates: Partial<ToolStatus>
): Promise<void> {
  const statuses = await loadToolStatus();
  const index = statuses.findIndex((s) => s.name === toolName);

  if (index >= 0) {
    statuses[index] = { ...statuses[index], ...updates };
  } else {
    statuses.push({
      name: toolName,
      available: true,
      failureCount: 0,
      ...updates,
    } as ToolStatus);
  }

  await saveToolStatus(statuses);
}

/**
 * 读取 Constitution
 */
export async function loadConstitution(
  projectScope: string
): Promise<string | null> {
  const config = await loadProjectsConfig();
  if (!config) return null;

  const projectKey = projectScope === 'fullstack' ? 'backend' : projectScope;
  const project = config.projects[projectKey];
  if (!project) return null;

  return await readText(project.constitutionPath);
}

/**
 * 保存单个任务执行结果
 */
export async function saveTaskResult(
  feedbackId: string,
  task: ExecutableTask
): Promise<void> {
  const date = parseFeedbackDate(feedbackId);
  const sddDir = getSDDDir(date, feedbackId);

  // 读取现有 tasks
  const tasksPath = `${sddDir}/tasks.json`;
  const existingTasks = await readJSON<ExecutableTask[]>(tasksPath);

  if (existingTasks) {
    // 更新对应任务
    const index = existingTasks.findIndex((t) => t.id === task.id);
    if (index >= 0) {
      existingTasks[index] = task;
      await writeJSON(tasksPath, existingTasks);
    }
  }
}

/**
 * 加载任务结果
 */
export async function loadTaskResults(
  feedbackId: string
): Promise<ExecutableTask[] | null> {
  const date = parseFeedbackDate(feedbackId);
  const tasksPath = `${getSDDDir(date, feedbackId)}/tasks.json`;

  return await readJSON<ExecutableTask[]>(tasksPath);
}

/**
 * 更新单个任务状态
 */
export async function updateTaskStatus(
  feedbackId: string,
  taskId: string,
  newStatus: 'pending' | 'in_progress' | 'completed' | 'failed',
  result?: ExecutableTask['result']
): Promise<void> {
  const tasks = await loadTaskResults(feedbackId);
  if (!tasks) return;

  const task = tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = newStatus;
    if (result) {
      task.result = result;
    }
    if (newStatus === 'in_progress' && !task.startedAt) {
      task.startedAt = new Date().toISOString();
    }
    if (newStatus === 'completed' || newStatus === 'failed') {
      task.completedAt = new Date().toISOString();
    }
    await saveTaskResult(feedbackId, task);
  }
}
