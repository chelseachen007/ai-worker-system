import type { Feedback, ExecutableTask } from '../types/index.js';
import {
  loadFeedback,
  saveFeedback,
  saveSDD,
  savePrompt,
  saveResponse,
  appendLog,
  loadConstitution,
} from '../storage/index.js';
import { generateSpecContent, buildPlanPrompt, buildTasksPrompt, extractTasksJSON } from '../generators/index.js';
import { FeedbackStateMachine } from '../core/state-machine.js';
import { TaskExecutor } from '../executors/task-executor.js';
import { aiAdapter } from '../executors/ai-adapter.js';

/**
 * Feedback Handler
 * 处理需求开发流程：spec → plan → tasks → execute
 */
export class FeedbackHandler {
  private taskExecutor: TaskExecutor;

  constructor() {
    this.taskExecutor = new TaskExecutor();
  }

  /**
   * 执行完整的 SDD 流程
   */
  async execute(feedbackId: string): Promise<boolean> {
    const feedback = await loadFeedback(feedbackId) as Feedback;
    if (!feedback) {
      throw new Error(`Feedback not found: ${feedbackId}`);
    }

    const stateMachine = new FeedbackStateMachine(feedback.status as any);

    // Step 1: 生成 spec
    await appendLog(feedbackId, '开始生成 spec.md');
    const spec = await this.generateSpec(feedback);
    if (!spec) {
      stateMachine.fail();
      await this.updateStatus(feedbackId, stateMachine.getStatus() as any);
      return false;
    }

    // Step 2: 生成 plan
    await appendLog(feedbackId, '开始生成 plan.md');
    const plan = await this.generatePlan(feedback, spec);
    if (!plan) {
      stateMachine.fail();
      await this.updateStatus(feedbackId, stateMachine.getStatus() as any);
      return false;
    }

    // Step 3: 拆解 tasks
    await appendLog(feedbackId, '开始拆解 tasks');
    const tasks = await this.generateTasks(feedback, spec, plan);
    if (!tasks || tasks.length === 0) {
      stateMachine.fail();
      await this.updateStatus(feedbackId, stateMachine.getStatus() as any);
      return false;
    }

    // 保存 SDD
    await saveSDD(feedbackId, { spec, plan, tasks });
    await appendLog(feedbackId, `SDD 生成完成，共 ${tasks.length} 个任务`);

    // 更新 feedback 状态
    feedback.sdd = { spec, plan, tasks };
    stateMachine.startExecuting();
    await this.updateStatus(feedbackId, stateMachine.getStatus() as any);
    await saveFeedback(feedback);

    // Step 4: 执行任务
    await appendLog(feedbackId, '开始执行任务');
    const success = await this.taskExecutor.execute(feedbackId, tasks);

    if (success) {
      stateMachine.complete();
      await appendLog(feedbackId, '所有任务执行完成');
    } else {
      stateMachine.fail();
      await appendLog(feedbackId, '任务执行失败', 'error');
    }

    await this.updateStatus(feedbackId, stateMachine.getStatus() as any);
    return success;
  }

  /**
   * 生成 spec.md
   */
  private async generateSpec(feedback: Feedback): Promise<string | null> {
    const content = generateSpecContent({
      feedbackId: feedback.id,
      description: feedback.userInput,
      summary: feedback.summary,
      projectScope: feedback.projectScope,
    });

    await savePrompt(feedback.id, 'spec-gen', `生成 spec.md:\n${content}`);
    await appendLog(feedback.id, 'spec.md 已生成（模板）');

    return content;
  }

  /**
   * 生成 plan.md
   */
  private async generatePlan(feedback: Feedback, spec: string): Promise<string | null> {
    // 加载 constitution
    const constitution = await loadConstitution(feedback.projectScope) || '';

    const prompt = buildPlanPrompt(spec, constitution, feedback.projectScope);
    await savePrompt(feedback.id, 'plan-gen', prompt);

    try {
      // 调用 AI 生成 plan
      const result = await aiAdapter.execute(prompt, {
        timeout: 180000, // 3分钟
      });

      await saveResponse(feedback.id, 'plan-gen', result.output);
      await appendLog(feedback.id, `AI 生成 plan 完成，响应长度: ${result.output.length}`);

      // 提取 plan 内容
      const plan = this.extractPlanContent(result.output);
      return plan;
    } catch (error) {
      await appendLog(feedback.id, `AI 生成 plan 失败: ${error}`, 'error');

      // 失败时使用模拟 plan
      const plan = this.mockGeneratePlan(feedback);
      await appendLog(feedback.id, '使用模拟 plan');
      return plan;
    }
  }

  /**
   * 提取 plan 内容
   */
  private extractPlanContent(response: string): string {
    // 尝试提取 Markdown 格式的 plan
    // 这里简化处理，直接返回整个响应
    // 实际可以更精确地提取 plan 部分
    return response;
  }

  /**
   * 模拟生成 plan
   */
  private mockGeneratePlan(feedback: Feedback): string {
    const lines: string[] = [];

    lines.push('## 技术方案概述');
    lines.push(`实现 "${feedback.userInput.slice(0, 30)}..." 功能。`);
    lines.push('');

    lines.push('## 涉及的文件和模块');
    lines.push('- 新建: `src/features/` 目录下的功能模块');
    lines.push('- 修改: 主入口文件');
    lines.push('');

    lines.push('## 关键实现步骤');
    lines.push('1. 创建功能模块');
    lines.push('2. 实现核心逻辑');
    lines.push('3. 集成到主程序');
    lines.push('4. 添加错误处理');
    lines.push('');

    lines.push('## 风险点与缓解措施');
    lines.push('- 向后兼容: 确保不影响现有功能');
    lines.push('- 性能: 避免引入性能问题');
    lines.push('');

    lines.push('## 测试策略');
    lines.push('- 单元测试覆盖核心逻辑');
    lines.push('- 手动验证功能正确性');

    return lines.join('\n');
  }

  /**
   * 生成 tasks
   */
  private async generateTasks(
    feedback: Feedback,
    spec: string,
    plan: string
  ): Promise<ExecutableTask[]> {
    const prompt = buildTasksPrompt(spec, plan);
    await savePrompt(feedback.id, 'tasks-gen', prompt);

    try {
      // 调用 AI 生成 tasks
      const result = await aiAdapter.execute(prompt, {
        timeout: 120000, // 2分钟
      });

      await saveResponse(feedback.id, 'tasks-gen', result.output);
      await appendLog(feedback.id, `AI 生成 tasks 完成，响应长度: ${result.output.length}`);

      // 解析 tasks JSON
      const jsonStr = extractTasksJSON(result.output);
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        const tasks = parsed.tasks || [];

        // 验证并转换任务格式
        return tasks.map((t: any) => ({
          id: t.id || `task-${Math.random().toString(36).substr(2, 6)}`,
          title: t.title || '无标题任务',
          description: t.description || '',
          files: t.files || [],
          project: t.project || feedback.projectScope === 'fullstack' ? 'backend' : feedback.projectScope,
          dependsOn: t.dependsOn || [],
          status: 'pending',
        }));
      }
    } catch (error) {
      await appendLog(feedback.id, `AI 生成 tasks 失败: ${error}`, 'error');
    }

    // 失败时使用模拟 tasks
    const tasks = this.mockGenerateTasks(feedback);
    await appendLog(feedback.id, '使用模拟 tasks');
    return tasks;
  }

  /**
   * 模拟生成 tasks
   */
  private mockGenerateTasks(feedback: Feedback): ExecutableTask[] {
    const prefix = feedback.id.slice(0, 8);
    const project = feedback.projectScope === 'fullstack' ? 'backend' : feedback.projectScope;

    return [
      {
        id: 'task-1',
        title: '分析需求并创建功能模块',
        description: `分析 "${feedback.userInput.slice(0, 30)}..." 需求，创建对应的功能模块文件`,
        files: [`src/features/${prefix}/index.ts`],
        project,
        dependsOn: [],
        status: 'pending',
      },
      {
        id: 'task-2',
        title: '实现核心功能逻辑',
        description: '实现功能的核心处理逻辑，包括输入验证、业务处理等',
        files: [`src/features/${prefix}/index.ts`],
        project,
        dependsOn: ['task-1'],
        status: 'pending',
      },
      {
        id: 'task-3',
        title: '集成到主程序',
        description: '将新功能集成到主程序入口，确保可被调用',
        files: ['src/index.ts'],
        project,
        dependsOn: ['task-2'],
        status: 'pending',
      },
    ];
  }

  /**
   * 更新反馈状态
   */
  private async updateStatus(feedbackId: string, newStatus: string): Promise<void> {
    const feedback = await loadFeedback(feedbackId) as Feedback;
    if (feedback) {
      (feedback as any).status = newStatus;
      feedback.updatedAt = new Date().toISOString();
      await saveFeedback(feedback);
    }
  }
}
