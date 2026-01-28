/**
 * 项目范围类型
 */
export type ProjectScope = 'backend' | 'frontend' | 'fullstack';

/**
 * Clarification 状态
 */
export type ClarificationStatus =
  | 'pending'       // 等待 AI 分析
  | 'processing'    // AI 正在分析
  | 'awaiting'      // 等待用户确认
  | 'confirmed'     // 用户已确认
  | 'cancelled'     // 用户取消
  | 'expired'       // 超时过期
  | 'failed';       // 处理失败

/**
 * Feedback 状态
 */
export type FeedbackStatus =
  | 'pending'       // 等待开始
  | 'analyzing'     // 生成 spec/plan/tasks
  | 'executing'     // 执行任务中
  | 'completed'     // 执行完成
  | 'failed';       // 执行失败

/**
 * 任务状态
 */
export type TaskStatus =
  | 'pending'       // 等待执行
  | 'in_progress'   // 执行中
  | 'completed'     // 完成
  | 'failed';       // 失败

/**
 * 澄清问题选项
 */
export interface ClarificationQuestion {
  id: string;
  question: string;
  options: string[];
  required: boolean;
  answer?: string;
}

/**
 * 澄清摘要
 */
export interface ClarificationSummary {
  summary?: string;
  goals: string[];
  acceptanceCriteria: string[];
  ambiguity: string[];
}

/**
 * 基础反馈接口
 */
export interface BaseFeedback {
  id: string;
  type: 'clarification' | 'feedback';
  status: ClarificationStatus | FeedbackStatus;
  userInput: string;
  projectScope: ProjectScope;
  createdAt: string;
  updatedAt: string;
}

/**
 * Clarification（需求澄清）
 */
export interface Clarification extends BaseFeedback {
  type: 'clarification';
  status: ClarificationStatus;
  summary?: ClarificationSummary;
  questions?: ClarificationQuestion[];
}

/**
 * 可执行任务
 */
export interface ExecutableTask {
  id: string;
  title: string;
  description: string;
  files: string[];
  project: 'backend' | 'frontend';
  dependsOn: string[];
  status: TaskStatus;
  result?: {
    exitCode: number;
    output: string;
    duration: number;
    tool?: string;
    error?: string;
  };
  startedAt?: string;
  completedAt?: string;
}

/**
 * SDD 文档
 */
export interface SDDDocument {
  spec: string;
  plan: string;
  tasks: ExecutableTask[];
}

/**
 * Feedback（需求开发）
 */
export interface Feedback extends BaseFeedback {
  type: 'feedback';
  status: FeedbackStatus;
  summary?: ClarificationSummary;
  sdd?: SDDDocument;
  confirmationId?: string;  // 关联的 clarification ID
}

/**
 * 联合类型
 */
export type AnyFeedback = Clarification | Feedback;

/**
 * AI 工具状态
 */
export interface ToolStatus {
  name: string;
  available: boolean;
  lastSuccess?: number;
  lastFailed?: number;
  responseTimeMs?: number;
  failureCount: number;
}

/**
 * 执行结果
 */
export interface ExecuteResult {
  exitCode: number;
  output: string;
  error?: string;
  duration: number;
  tool: string;
}

/**
 * 系统状态
 */
export interface SystemStatus {
  schedulerRunning: boolean;
  pendingClarifications: number;
  pendingFeedbacks: number;
  activeTasks: number;
  tools: ToolStatus[];
}

/**
 * 项目配置
 */
export interface ProjectConfig {
  name: string;
  path: string;
  constitutionPath: string;
}

/**
 * 工具配置
 */
export interface ToolConfig {
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  priority: number;
}

/**
 * 配置文件类型
 */
export interface ProjectsConfig {
  projects: Record<string, ProjectConfig>;
}

export interface ToolsConfig {
  tools: ToolConfig[];
  maxRetries: number;
  retryDelayMs: number;
  failureCooldownMs: number;
  defaultTool: string;
}

/**
 * 任务分组
 */
export interface TaskGroups {
  backend: ExecutableTask[];
  frontend: ExecutableTask[];
}

/**
 * 状态转换结果
 */
export interface StateTransitionResult {
  success: boolean;
  newStatus?: ClarificationStatus | FeedbackStatus | TaskStatus;
  error?: string;
}

/**
 * SDD 生成器输入
 */
export interface SpecGeneratorInput {
  feedbackId: string;
  description: string;
  summary?: ClarificationSummary;
  projectScope: ProjectScope;
}

/**
 * Prompt 模板变量
 */
export interface PromptVariables {
  feedbackId: string;
  userInput: string;
  projectScope: ProjectScope;
  constitution?: string;
  spec?: string;
  plan?: string;
}
