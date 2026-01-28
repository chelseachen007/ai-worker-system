import type { AnyFeedback } from '../types/index.js';
import {
  listPendingFeedbacks,
  updateFeedbackStatus,
} from '../storage/index.js';
import { FeedbackHandler } from '../handlers/index.js';
import { ClarificationHandler } from '../handlers/clarification.js';

/**
 * 调度器配置
 */
interface SchedulerConfig {
  pollInterval: number;  // 轮询间隔（毫秒）
  maxConcurrent: number; // 最大并发任务数
}

/**
 * 调度器
 * 轮询任务队列并分发到对应 Handler
 */
export class Scheduler {
  private config: SchedulerConfig;
  private running: boolean = false;
  private timer?: NodeJS.Timeout;
  private feedbackHandler: FeedbackHandler;
  private clarificationHandler: ClarificationHandler;
  private activeTasks: Set<string> = new Set();

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = {
      pollInterval: 5000,  // 默认 5 秒
      maxConcurrent: 3,    // 默认最多 3 个并发任务
      ...config,
    };
    this.feedbackHandler = new FeedbackHandler();
    this.clarificationHandler = new ClarificationHandler();
  }

  /**
   * 启动调度器
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log('调度器已在运行');
      return;
    }

    this.running = true;
    console.log('调度器已启动');

    // 立即执行一次
    await this.poll();

    // 开始轮询
    this.timer = setInterval(() => {
      this.poll().catch((error) => {
        console.error('轮询错误:', error);
      });
    }, this.config.pollInterval);
  }

  /**
   * 停止调度器
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    // 等待活跃任务完成
    while (this.activeTasks.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log('调度器已停止');
  }

  /**
   * 轮询任务队列
   */
  async poll(): Promise<void> {
    if (!this.running) {
      return;
    }

    try {
      const pending = await listPendingFeedbacks();

      // 处理 Clarification
      for (const clarification of pending.clarifications) {
        if (!this.canStartTask()) {
          break;
        }
        await this.handleClarification(clarification);
      }

      // 处理 Feedback
      for (const feedback of pending.feedbacks) {
        if (!this.canStartTask()) {
          break;
        }
        await this.handleFeedback(feedback);
      }
    } catch (error) {
      console.error('轮询错误:', error);
    }
  }

  /**
   * 检查是否可以开始新任务
   */
  private canStartTask(): boolean {
    return this.activeTasks.size < this.config.maxConcurrent;
  }

  /**
   * 处理 Clarification
   */
  private async handleClarification(clarification: AnyFeedback): Promise<void> {
    const id = clarification.id;
    this.activeTasks.add(id);

    try {
      console.log(`[Clarification] 处理 ${id}`);

      // 更新状态为 processing
      await updateFeedbackStatus(id, 'processing');

      // 调用 ClarificationHandler 分析
      const result = await this.clarificationHandler.analyze(id);

      if (result.needsClarification && result.questions && result.questions.length > 0) {
        // 需要用户澄清
        await updateFeedbackStatus(id, 'awaiting');
        console.log(`[Clarification] ${id} 需要用户澄清，${result.questions.length} 个问题`);
      } else {
        // 可以直接进入开发阶段
        await updateFeedbackStatus(id, 'confirmed');
        console.log(`[Clarification] ${id} 已确认，可进入开发`);
      }

      console.log(`[Clarification] 完成 ${id}`);
    } catch (error) {
      console.error(`[Clarification] 错误 ${id}:`, error);
      await updateFeedbackStatus(id, 'failed');
    } finally {
      this.activeTasks.delete(id);
    }
  }

  /**
   * 处理 Feedback
   */
  private async handleFeedback(feedback: AnyFeedback): Promise<void> {
    const id = feedback.id;
    this.activeTasks.add(id);

    try {
      console.log(`[Feedback] 处理 ${id}`);

      // 根据当前状态决定下一步
      if (feedback.status === 'pending') {
        await updateFeedbackStatus(id, 'analyzing');
        await this.feedbackHandler.execute(id);
      } else if (feedback.status === 'analyzing') {
        // 可能是之前中断的，继续执行
        await this.feedbackHandler.execute(id);
      } else if (feedback.status === 'executing') {
        // 继续执行任务
        await this.feedbackHandler.execute(id);
      }

      console.log(`[Feedback] 完成 ${id}`);
    } catch (error) {
      console.error(`[Feedback] 错误 ${id}:`, error);
      await updateFeedbackStatus(id, 'failed');
    } finally {
      this.activeTasks.delete(id);
    }
  }

  /**
   * 获取运行状态
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 获取活跃任务数量
   */
  getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  /**
   * 获取活跃任务列表
   */
  getActiveTasks(): string[] {
    return Array.from(this.activeTasks);
  }
}

// 全局调度器实例
let globalScheduler: Scheduler | null = null;

/**
 * 获取全局调度器
 */
export function getScheduler(): Scheduler {
  if (!globalScheduler) {
    globalScheduler = new Scheduler();
  }
  return globalScheduler;
}

/**
 * 启动全局调度器
 */
export async function startScheduler(): Promise<void> {
  await getScheduler().start();
}

/**
 * 停止全局调度器
 */
export async function stopScheduler(): Promise<void> {
  if (globalScheduler) {
    await globalScheduler.stop();
  }
}
