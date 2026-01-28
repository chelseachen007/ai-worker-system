import chalk from 'chalk';
import type { AnyFeedback, ExecutableTask } from '../types/index.js';
import { CLIOutput } from './output.js';

/**
 * 反馈列表视图
 */
export function renderFeedbackList(feedbacks: AnyFeedback[]): void {
  CLIOutput.title('反馈列表');

  if (feedbacks.length === 0) {
    CLIOutput.info('暂无反馈');
    return;
  }

  const widths = [24, 12, 16, 30];
  CLIOutput.row(['ID', '类型', '状态', '时间'], widths);
  CLIOutput.separator(widths);

  for (const fb of feedbacks) {
    const id = fb.id.slice(0, 23);
    const type = fb.type === 'clarification' ? '需求澄清' : '需求开发';
    const status = CLIOutput.status(fb.status);
    const time = fb.createdAt.slice(0, 19).replace('T', ' ');
    CLIOutput.row([id, type, status, time], widths);
  }
}

/**
 * 反馈详情视图
 */
export function renderFeedbackDetail(feedback: AnyFeedback): void {
  const type = feedback.type === 'clarification' ? '需求澄清' : '需求开发';
  CLIOutput.title(`${type} - ${feedback.id}`);

  CLIOutput.keyValue('状态', CLIOutput.status(feedback.status));
  CLIOutput.keyValue('项目范围', CLIOutput.projectScope(feedback.projectScope));
  CLIOutput.keyValue('创建时间', CLIOutput.date(feedback.createdAt));
  CLIOutput.keyValue('更新时间', CLIOutput.date(feedback.updatedAt));

  CLIOutput.subtitle('用户输入');
  console.log(feedback.userInput);

  if ('summary' in feedback && feedback.summary) {
    if (feedback.summary.goals?.length > 0) {
      CLIOutput.subtitle('功能目标');
      CLIOutput.list(feedback.summary.goals);
    }

    if (feedback.summary.acceptanceCriteria?.length > 0) {
      CLIOutput.subtitle('验收标准');
      feedback.summary.acceptanceCriteria.forEach((ac, i) => {
        CLIOutput.checkbox(false, `AC-${String(i + 1).padStart(2, '0')}: ${ac}`);
      });
    }
  }

  if ('questions' in feedback && feedback.questions && feedback.questions.length > 0) {
    CLIOutput.subtitle('待确认问题');
    feedback.questions.forEach((q, i) => {
      console.log(`\n${i + 1}. ${q.question}`);
      q.options.forEach((opt) => {
        const prefix = q.answer === opt ? chalk.green('●') : chalk.gray('○');
        console.log(`  ${prefix} ${opt}`);
      });
    });
  }

  if (feedback.type === 'feedback' && feedback.sdd) {
    CLIOutput.subtitle('SDD 文档');
    console.log(`  Spec:   ${feedback.sdd.spec ? '已生成' : chalk.gray('未生成')}`);
    console.log(`  Plan:   ${feedback.sdd.plan ? '已生成' : chalk.gray('未生成')}`);
    console.log(`  Tasks:  ${feedback.sdd.tasks.length} 个任务`);
  }
}

/**
 * 任务列表视图
 */
export function renderTaskList(tasks: ExecutableTask[]): void {
  CLIOutput.subtitle('任务列表');

  if (tasks.length === 0) {
    CLIOutput.info('暂无任务');
    return;
  }

  const completed = tasks.filter((t) => t.status === 'completed').length;
  console.log(`进度: ${CLIOutput.progress(completed, tasks.length)}`);
  console.log('');

  for (const task of tasks) {
    const statusIcon = {
      pending: chalk.gray('○'),
      in_progress: chalk.blue('◐'),
      completed: chalk.green('●'),
      failed: chalk.red('✗'),
    }[task.status];

    console.log(`${statusIcon} ${chalk.bold(task.id)}: ${task.title}`);
    console.log(`   ${chalk.gray(task.description)}`);
    console.log(`   项目: ${chalk.magenta(task.project)} | 依赖: ${task.dependsOn.join(', ') || '无'}`);

    if (task.result) {
      const duration = (task.result.duration / 1000).toFixed(1);
      console.log(`   耗时: ${duration}s | 工具: ${task.result.tool || 'unknown'}`);
    }

    console.log('');
  }
}

/**
 * 澄清确认界面
 */
export function renderClarificationConfirmation(
  feedback: AnyFeedback,
  summary?: any,
  questions?: any[]
): void {
  console.clear();
  CLIOutput.title(`需求澄清 - ${feedback.id}`);

  console.log(`${chalk.bold('原文:')}: ${feedback.userInput}`);
  CLIOutput.divider();

  if (summary) {
    CLIOutput.subtitle('AI 分析结果');

    if (summary.goals?.length > 0) {
      console.log('\n功能目标:');
      CLIOutput.list(summary.goals);
    }

    if (summary.acceptanceCriteria?.length > 0) {
      console.log('\n验收标准:');
      summary.acceptanceCriteria.forEach((ac: string, i: number) => {
        CLIOutput.checkbox(false, `AC-${String(i + 1).padStart(2, '0')}: ${ac}`);
      });
    }
  }

  if (questions && questions.length > 0) {
    CLIOutput.subtitle('待确认问题');
    questions.forEach((q: any, i: number) => {
      console.log(`\n${chalk.bold.cyan(i + 1)}. ${q.question}`);
      q.options.forEach((opt: string) => {
        const prefix = q.answer === opt ? chalk.green('●') : chalk.gray('○');
        console.log(`  ${prefix} ${opt}`);
      });
    });
  }

  CLIOutput.divider();
  console.log(`${chalk.gray('[↑↓ 选择]')} ${chalk.gray('[Enter 确认]')} ${chalk.gray('[Esc 取消]')}`);
}

/**
 * 系统状态视图
 */
export function renderSystemStatus(status: {
  schedulerRunning: boolean;
  pendingClarifications: number;
  pendingFeedbacks: number;
  activeTasks: number;
  tools: any[];
}): void {
  CLIOutput.title('系统状态');

  console.log(`调度器: ${status.schedulerRunning ? chalk.green('运行中') : chalk.red('已停止')}`);
  console.log(`待处理澄清: ${status.pendingClarifications}`);
  console.log(`待处理反馈: ${status.pendingFeedbacks}`);
  console.log(`活跃任务: ${status.activeTasks}`);

  CLIOutput.subtitle('AI 工具状态');
  status.tools.forEach((tool) => {
    const status = tool.available ? chalk.green('可用') : chalk.red('不可用');
    const responseTime = tool.responseTimeMs ? `${tool.responseTimeMs}ms` : 'N/A';
    console.log(`  ${chalk.cyan(tool.name)}: ${status} | 响应: ${responseTime} | 失败: ${tool.failureCount}`);
  });
}
