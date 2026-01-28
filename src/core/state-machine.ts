import type {
  ClarificationStatus,
  FeedbackStatus,
  TaskStatus,
  StateTransitionResult,
} from '../types/index.js';
import { canTransition, isTerminalStatus, isFailedStatus } from '../types/constants.js';

/**
 * 状态机管理器
 */
export class StateMachine<T extends string> {
  private currentStatus: T;
  private readonly type: 'clarification' | 'feedback' | 'task';
  private readonly statusHistory: Array<{ status: T; timestamp: string }> = [];

  constructor(
    initialStatus: T,
    type: 'clarification' | 'feedback' | 'task'
  ) {
    this.currentStatus = initialStatus;
    this.type = type;
    this.recordState(initialStatus);
  }

  /**
   * 获取当前状态
   */
  getStatus(): T {
    return this.currentStatus;
  }

  /**
   * 尝试转换到新状态
   */
  transition(newStatus: T): StateTransitionResult {
    // 检查是否已经是目标状态
    if (this.currentStatus === newStatus) {
      return {
        success: true,
        newStatus: newStatus as any,
      };
    }

    // 检查转换是否合法
    if (!canTransition(this.currentStatus as string, newStatus as string, this.type)) {
      return {
        success: false,
        error: `Invalid state transition from ${this.currentStatus} to ${newStatus}`,
      };
    }

    // 执行转换
    this.currentStatus = newStatus;
    this.recordState(newStatus);

    return {
      success: true,
      newStatus: newStatus as any,
    };
  }

  /**
   * 强制转换状态（跳过验证）
   */
  forceTransition(newStatus: T): StateTransitionResult {
    this.currentStatus = newStatus;
    this.recordState(newStatus);
    return {
      success: true,
      newStatus: newStatus as any,
    };
  }

  /**
   * 检查是否为终态
   */
  isTerminal(): boolean {
    return isTerminalStatus(this.currentStatus);
  }

  /**
   * 检查是否为失败状态
   */
  isFailed(): boolean {
    return isFailedStatus(this.currentStatus);
  }

  /**
   * 获取状态历史
   */
  getHistory(): Array<{ status: T; timestamp: string }> {
    return [...this.statusHistory];
  }

  /**
   * 记录状态
   */
  private recordState(status: T): void {
    this.statusHistory.push({
      status,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Clarification 状态机
 */
export class ClarificationStateMachine extends StateMachine<ClarificationStatus> {
  constructor(initialStatus: ClarificationStatus = 'pending') {
    super(initialStatus, 'clarification');
  }

  /**
   * 开始处理
   */
  startProcessing(): StateTransitionResult {
    return this.transition('processing');
  }

  /**
   * 等待用户确认
   */
  awaitUser(): StateTransitionResult {
    return this.transition('awaiting');
  }

  /**
   * 用户确认
   */
  confirm(): StateTransitionResult {
    return this.transition('confirmed');
  }

  /**
   * 用户取消
   */
  cancel(): StateTransitionResult {
    return this.transition('cancelled');
  }

  /**
   * 标记为过期
   */
  expire(): StateTransitionResult {
    return this.transition('expired');
  }

  /**
   * 标记为失败
   */
  fail(): StateTransitionResult {
    return this.transition('failed');
  }

  /**
   * 重试
   */
  retry(): StateTransitionResult {
    return this.transition('pending');
  }

  /**
   * 是否可以处理
   */
  canProcess(): boolean {
    return this.getStatus() === 'pending';
  }

  /**
   * 是否需要用户确认
   */
  needsConfirmation(): boolean {
    return this.getStatus() === 'awaiting';
  }

  /**
   * 是否已完成确认
   */
  isConfirmed(): boolean {
    return this.getStatus() === 'confirmed';
  }
}

/**
 * Feedback 状态机
 */
export class FeedbackStateMachine extends StateMachine<FeedbackStatus> {
  constructor(initialStatus: FeedbackStatus = 'pending') {
    super(initialStatus, 'feedback');
  }

  /**
   * 开始分析
   */
  startAnalyzing(): StateTransitionResult {
    return this.transition('analyzing');
  }

  /**
   * 开始执行
   */
  startExecuting(): StateTransitionResult {
    return this.transition('executing');
  }

  /**
   * 完成
   */
  complete(): StateTransitionResult {
    return this.transition('completed');
  }

  /**
   * 标记为失败
   */
  fail(): StateTransitionResult {
    return this.transition('failed');
  }

  /**
   * 重试
   */
  retry(): StateTransitionResult {
    return this.transition('pending');
  }

  /**
   * 是否可以分析
   */
  canAnalyze(): boolean {
    return this.getStatus() === 'pending';
  }

  /**
   * 是否正在执行
   */
  isExecuting(): boolean {
    return this.getStatus() === 'executing';
  }

  /**
   * 是否已完成
   */
  isCompleted(): boolean {
    return this.getStatus() === 'completed';
  }
}

/**
 * Task 状态机
 */
export class TaskStateMachine extends StateMachine<TaskStatus> {
  constructor(initialStatus: TaskStatus = 'pending') {
    super(initialStatus, 'task');
  }

  /**
   * 开始执行
   */
  start(): StateTransitionResult {
    return this.transition('in_progress');
  }

  /**
   * 完成
   */
  complete(): StateTransitionResult {
    return this.transition('completed');
  }

  /**
   * 标记为失败
   */
  fail(): StateTransitionResult {
    return this.transition('failed');
  }

  /**
   * 重试
   */
  retry(): StateTransitionResult {
    return this.transition('pending');
  }

  /**
   * 是否可以执行
   */
  canStart(): boolean {
    return this.getStatus() === 'pending';
  }

  /**
   * 是否正在执行
   */
  isInProgress(): boolean {
    return this.getStatus() === 'in_progress';
  }

  /**
   * 是否已完成
   */
  isCompleted(): boolean {
    return this.getStatus() === 'completed';
  }
}

/**
 * 任务依赖检查器
 */
export class TaskDependencyChecker {
  /**
   * 检查任务是否可以执行（所有依赖已完成）
   */
  static canExecute(
    _taskId: string,
    dependsOn: string[],
    tasks: Map<string, TaskStateMachine>
  ): boolean {
    for (const depId of dependsOn) {
      const depTask = tasks.get(depId);
      if (!depTask || !depTask.isCompleted()) {
        return false;
      }
    }
    return true;
  }

  /**
   * 获取可执行的任务列表
   */
  static getExecutableTasks(
    tasks: Map<string, TaskStateMachine>
  ): string[] {
    const executable: string[] = [];

    for (const [id, task] of tasks.entries()) {
      if (task.canStart()) {
        // 这里需要额外的依赖信息，实际使用时需要传入
        executable.push(id);
      }
    }

    return executable;
  }
}
