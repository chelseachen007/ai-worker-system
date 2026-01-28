/**
 * Clarification 状态流转规则
 */
export const CLARIFICATION_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['awaiting', 'confirmed', 'failed'],
  awaiting: ['confirmed', 'cancelled', 'expired'],
  confirmed: [],  // 终态
  cancelled: [],  // 终态
  expired: [],    // 终态
  failed: ['pending'],  // 可重试
};

/**
 * Feedback 状态流转规则
 */
export const FEEDBACK_TRANSITIONS: Record<string, string[]> = {
  pending: ['analyzing', 'failed'],
  analyzing: ['executing', 'failed'],
  executing: ['completed', 'failed'],
  completed: [],  // 终态
  failed: ['pending'],  // 可重试
};

/**
 * Task 状态流转规则
 */
export const TASK_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress'],
  in_progress: ['completed', 'failed'],
  completed: [],  // 终态
  failed: ['pending'],  // 可重试
};

/**
 * 项目范围标签
 */
export const PROJECT_SCOPE_LABELS: Record<string, string> = {
  backend: '后端项目',
  frontend: '前端项目',
  fullstack: '全栈（前后端）',
};

/**
 * 状态颜色映射（用于 CLI 显示）
 */
export const STATUS_COLORS: Record<string, string> = {
  // Clarification
  pending: 'yellow',
  processing: 'blue',
  awaiting: 'cyan',
  confirmed: 'green',
  cancelled: 'gray',
  expired: 'red',
  failed: 'red',

  // Feedback
  analyzing: 'blue',
  executing: 'blue',
  completed: 'green',

  // Task
  in_progress: 'blue',
};

/**
 * 状态显示标签
 */
export const STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  processing: '处理中',
  awaiting: '待确认',
  confirmed: '已确认',
  cancelled: '已取消',
  expired: '已过期',
  failed: '失败',
  analyzing: '分析中',
  executing: '执行中',
  completed: '已完成',
  in_progress: '执行中',
};

/**
 * 检查状态转换是否合法
 */
export function canTransition(
  currentStatus: string,
  newStatus: string,
  type: 'clarification' | 'feedback' | 'task'
): boolean {
  const transitions =
    type === 'clarification'
      ? CLARIFICATION_TRANSITIONS
      : type === 'feedback'
        ? FEEDBACK_TRANSITIONS
        : TASK_TRANSITIONS;

  const allowed = transitions[currentStatus] || [];
  return allowed.includes(newStatus);
}

/**
 * 获取状态颜色
 */
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || 'white';
}

/**
 * 获取状态标签
 */
export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

/**
 * 是否为终态
 */
export function isTerminalStatus(status: string): boolean {
  return ['confirmed', 'cancelled', 'expired', 'completed'].includes(status);
}

/**
 * 是否为失败状态
 */
export function isFailedStatus(status: string): boolean {
  return status === 'failed' || status === 'expired';
}
