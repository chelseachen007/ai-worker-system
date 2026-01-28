import type { ExecutableTask, TaskGroups } from '../types/index.js';
import {
  appendLog,
  saveTaskResult,
} from '../storage/index.js';
import { aiAdapter } from './ai-adapter.js';
import { TaskStateMachine } from '../core/state-machine.js';

/**
 * 任务执行器
 * 实现组间并发、组内串行的执行策略
 */
export class TaskExecutor {
  /**
   * 执行任务列表
   */
  async execute(feedbackId: string, tasks: ExecutableTask[]): Promise<boolean> {
    await appendLog(feedbackId, `开始执行 ${tasks.length} 个任务`);

    // 按项目分组
    const groups = this.groupTasksByProject(tasks);

    // 组间并发，组内串行
    const results = await Promise.all([
      groups.backend.length > 0
        ? this.executeTaskGroup(feedbackId, groups.backend, 'backend')
        : Promise.resolve(true),
      groups.frontend.length > 0
        ? this.executeTaskGroup(feedbackId, groups.frontend, 'frontend')
        : Promise.resolve(true),
    ]);

    const allSuccess = results.every((r) => r);
    await appendLog(feedbackId, `任务执行${allSuccess ? '成功' : '失败'}`);

    return allSuccess;
  }

  /**
   * 按项目分组任务
   */
  private groupTasksByProject(tasks: ExecutableTask[]): TaskGroups {
    const backend: ExecutableTask[] = [];
    const frontend: ExecutableTask[] = [];

    for (const task of tasks) {
      if (task.project === 'frontend') {
        frontend.push(task);
      } else {
        backend.push(task);
      }
    }

    return { backend, frontend };
  }

  /**
   * 执行任务组（串行，按依赖顺序）
   */
  private async executeTaskGroup(
    feedbackId: string,
    tasks: ExecutableTask[],
    groupName: string
  ): Promise<boolean> {
    await appendLog(feedbackId, `执行 ${groupName} 任务组，共 ${tasks.length} 个任务`);

    // 按依赖顺序排序
    const sorted = this.sortTasksByDependency(tasks);

    for (const task of sorted) {
      const stateMachine = new TaskStateMachine(task.status);
      if (!stateMachine.canStart()) {
        await appendLog(feedbackId, `任务 ${task.id} 状态为 ${task.status}，跳过`);
        continue;
      }

      // 检查依赖是否完成
      if (!this.checkDependencies(task, sorted)) {
        await appendLog(feedbackId, `任务 ${task.id} 的依赖未完成，跳过`, 'warn');
        continue;
      }

      // 执行任务
      stateMachine.start();
      await appendLog(feedbackId, `开始执行任务 ${task.id}: ${task.title}`);

      const result = await this.executeTask(feedbackId, task);

      if (result) {
        stateMachine.complete();
        await appendLog(feedbackId, `任务 ${task.id} 完成`);
      } else {
        stateMachine.fail();
        await appendLog(feedbackId, `任务 ${task.id} 失败`, 'error');
        return false; // 组内串行，一个失败则停止
      }
    }

    return true;
  }

  /**
   * 按依赖关系排序任务
   */
  private sortTasksByDependency(tasks: ExecutableTask[]): ExecutableTask[] {
    const sorted: ExecutableTask[] = [];
    const remaining = [...tasks];
    const processed = new Set<string>();

    let maxIterations = tasks.length * 2;
    let iterations = 0;

    while (remaining.length > 0 && iterations < maxIterations) {
      iterations++;

      for (let i = remaining.length - 1; i >= 0; i--) {
        const task = remaining[i];

        // 检查所有依赖是否已处理
        const allDepsProcessed = task.dependsOn.every((dep) =>
          processed.has(dep)
        );

        if (allDepsProcessed) {
          sorted.push(task);
          processed.add(task.id);
          remaining.splice(i, 1);
        }
      }
    }

    // 剩余的任务（循环依赖或其他问题）
    if (remaining.length > 0) {
      sorted.push(...remaining);
    }

    return sorted;
  }

  /**
   * 检查任务依赖是否完成
   */
  private checkDependencies(task: ExecutableTask, allTasks: ExecutableTask[]): boolean {
    for (const depId of task.dependsOn) {
      const depTask = allTasks.find((t) => t.id === depId);
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  /**
   * 执行单个任务
   */
  private async executeTask(
    feedbackId: string,
    task: ExecutableTask
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      // 更新状态为 in_progress
      task.status = 'in_progress';
      task.startedAt = new Date().toISOString();
      await saveTaskResult(feedbackId, task);

      // 构建任务执行 Prompt
      const prompt = this.buildTaskPrompt(task);

      // 调用 AI 执行
      const result = await aiAdapter.execute(prompt);

      // 更新任务结果
      task.result = {
        exitCode: 0,
        output: '',
        duration: result.duration,
        tool: result.tool,
      };
      task.completedAt = new Date().toISOString();
      task.status = 'completed';

      await saveTaskResult(feedbackId, task);
      await appendLog(
        feedbackId,
        `任务 ${task.id} 执行完成，耗时 ${result.duration}ms`
      );

      return result.exitCode === 0;
    } catch (error) {
      task.result = {
        exitCode: 1,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
      task.completedAt = new Date().toISOString();
      task.status = 'failed';

      await saveTaskResult(feedbackId, task);
      await appendLog(
        feedbackId,
        `任务 ${task.id} 执行异常: ${error}`,
        'error'
      );

      return false;
    }
  }

  /**
   * 构建任务执行 Prompt
   */
  private buildTaskPrompt(task: ExecutableTask): string {
    const lines: string[] = [];

    lines.push(`任务: ${task.title}`);
    lines.push('');
    lines.push(task.description);
    lines.push('');

    if (task.files.length > 0) {
      lines.push('涉及文件:');
      task.files.forEach((f) => lines.push(`  - ${f}`));
      lines.push('');
    }

    if (task.dependsOn.length > 0) {
      lines.push(`依赖任务: ${task.dependsOn.join(', ')}`);
      lines.push('');
    }

    lines.push('请执行此任务。');

    return lines.join('\n');
  }
}
