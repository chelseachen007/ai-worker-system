#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import { CLIOutput } from '../utils/output.js';
import {
  generateFeedbackId,
  saveFeedback,
  listFeedbacksByDate,
  loadFeedback,
  renderFeedbackList,
  renderFeedbackDetail,
  renderSystemStatus,
} from '../utils/commands.js';
import type { AnyFeedback, Clarification, Feedback } from '../types/index.js';
import { startScheduler, stopScheduler, getScheduler } from '../core/scheduler.js';
import { listPendingFeedbacks, loadToolStatus } from '../storage/index.js';
import { aiAdapter } from '../executors/ai-adapter.js';
import { ClarificationHandler } from '../handlers/clarification.js';
import { registerYouTubeCommands } from './yt-commands.js';

const program = new Command();

program
  .name('ai-worker')
  .description('24h AI Worker System - AI Agent 调度系统')
  .version('1.0.1');

/**
 * 提交反馈命令
 */
program
  .command('feedback <message>')
  .description('提交用户反馈或需求')
  .option('-s, --scope <type>', '项目范围', 'backend')
  .option('-t, --type <type>', '反馈类型', 'clarification')
  .action(async (message: string, options: { scope: string; type: string }) => {
    CLIOutput.title('提交反馈');

    const feedbackId = generateFeedbackId();

    let feedback: AnyFeedback;
    if (options.type === 'clarification') {
      feedback = {
        id: feedbackId,
        type: 'clarification',
        status: 'pending',
        userInput: message,
        projectScope: options.scope as 'backend' | 'frontend' | 'fullstack',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Clarification;
    } else {
      feedback = {
        id: feedbackId,
        type: 'feedback',
        status: 'pending',
        userInput: message,
        projectScope: options.scope as 'backend' | 'frontend' | 'fullstack',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Feedback;
    }

    await saveFeedback(feedback);

    CLIOutput.success('反馈已提交');
    CLIOutput.keyValue('ID', feedbackId);
    CLIOutput.keyValue('类型', options.type === 'clarification' ? '需求澄清' : '需求开发');
    CLIOutput.keyValue('项目范围', options.scope);
  });

/**
 * 列出反馈命令
 */
program
  .command('list')
  .description('查看反馈列表')
  .option('-d, --date <date>', '指定日期 (YYYY-MM-DD)', new Date().toISOString().slice(0, 10))
  .option('--all', '显示所有状态')
  .action(async (options: { date: string; all: boolean }) => {
    const feedbacks = await listFeedbacksByDate(options.date);
    renderFeedbackList(feedbacks);
  });

/**
 * 查看详情命令
 */
program
  .command('show <feedbackId>')
  .description('查看反馈详情')
  .action(async (feedbackId: string) => {
    const feedback = await loadFeedback(feedbackId);
    if (!feedback) {
      CLIOutput.error(`找不到反馈: ${feedbackId}`);
      return;
    }
    renderFeedbackDetail(feedback);
  });

/**
 * 确认澄清命令
 */
program
  .command('confirm <feedbackId>')
  .description('确认澄清问题')
  .action(async (feedbackId: string) => {
    const feedback = await loadFeedback(feedbackId);
    if (!feedback) {
      CLIOutput.error(`找不到反馈: ${feedbackId}`);
      return;
    }

    if (feedback.type !== 'clarification') {
      CLIOutput.error('只能确认需求澄清类型的反馈');
      return;
    }

    if (feedback.status !== 'awaiting') {
      CLIOutput.error(`当前状态为 ${feedback.status}，无法确认`);
      return;
    }

    const clarification = feedback as Clarification;
    const questions = clarification.questions || [];

    // 显示问题列表
    if (questions.length > 0) {
      CLIOutput.title('澄清问题');
      for (const q of questions) {
        CLIOutput.keyValue(q.id, q.question);
      }
      console.log('');
    }

    const answers: any = {};
    for (const q of questions) {
      const { answer } = await inquirer.prompt([
        {
          type: 'list',
          name: 'answer',
          message: q.question,
          choices: q.options,
          default: q.options[0],
        },
      ]);
      answers[q.id] = answer;
    }

    // 调用 ClarificationHandler 保存答案
    const handler = new ClarificationHandler();
    const confirmed = await handler.confirm(feedbackId, answers);

    if (confirmed) {
      CLIOutput.success('确认完成');

      // 创建关联的 Feedback
      try {
        const newFeedbackId = await handler.createFeedback(feedbackId);
        CLIOutput.keyValue('新 Feedback ID', newFeedbackId);
        CLIOutput.info('需求已进入开发队列');
      } catch (error) {
        CLIOutput.error(`创建 Feedback 失败: ${error}`);
      }
    } else {
      CLIOutput.error('确认失败');
    }
  });

/**
 * 启动调度器命令
 */
program
  .command('start')
  .description('启动调度器')
  .option('-d, --daemon', '以守护进程模式运行')
  .action(async (options: { daemon: boolean }) => {
    CLIOutput.title('启动调度器');

    await startScheduler();

    CLIOutput.success('调度器已启动');
    CLIOutput.keyValue('轮询间隔', '5 秒');
    CLIOutput.keyValue('最大并发', '3 个任务');

    if (options.daemon) {
      console.log('\n调度器运行中，按 Ctrl+C 停止...');

      // 处理退出信号
      process.on('SIGINT', async () => {
        console.log('\n');
        CLIOutput.info('正在停止调度器...');
        await stopScheduler();
        process.exit(0);
      });

      // 保持运行
      await new Promise(() => {}); // 永不 resolve
    }
  });

/**
 * 停止调度器命令
 */
program
  .command('stop')
  .description('停止调度器')
  .action(async () => {
    CLIOutput.title('停止调度器');

    const scheduler = getScheduler();
    if (!scheduler.isRunning()) {
      CLIOutput.warn('调度器未运行');
      return;
    }

    await stopScheduler();
    CLIOutput.success('调度器已停止');
  });

/**
 * 状态命令
 */
program
  .command('status')
  .description('查看系统状态')
  .action(async () => {
    const scheduler = getScheduler();
    const pending = await listPendingFeedbacks();
    const tools = await loadToolStatus();

    renderSystemStatus({
      schedulerRunning: scheduler.isRunning(),
      pendingClarifications: pending.clarifications.length,
      pendingFeedbacks: pending.feedbacks.length,
      activeTasks: scheduler.getActiveTaskCount(),
      tools,
    });
  });

/**
 * 测试命令
 */
program
  .command('test')
  .description('测试命令')
  .action(() => {
    CLIOutput.title('测试输出');

    CLIOutput.success('成功消息');
    CLIOutput.error('错误消息');
    CLIOutput.warn('警告消息');
    CLIOutput.info('信息消息');

    console.log('');
    CLIOutput.keyValue('状态', CLIOutput.status('pending'));
    CLIOutput.keyValue('日期', CLIOutput.date(new Date().toISOString()));
    CLIOutput.keyValue('项目', CLIOutput.projectScope('backend'));

    console.log('');
    console.log('进度:', CLIOutput.progress(3, 10));
  });

/**
 * 测试 Claude 命令
 */
program
  .command('claude-test')
  .description('测试 Claude CLI 集成')
  .argument('[prompt]', '测试 prompt', '用一句话解释什么是 TypeScript')
  .action(async (prompt) => {
    CLIOutput.title('测试 Claude CLI 集成');

    try {
      // 测试 Claude CLI 可用性
      const available = await aiAdapter.testClaude();
      if (!available) {
        CLIOutput.error('Claude CLI 不可用');
        return;
      }

      CLIOutput.success('Claude CLI 可用');

      // 执行测试 prompt
      CLIOutput.info(`执行 prompt: ${prompt}`);
      console.log('');

      const result = await aiAdapter.execute(prompt, {
        timeout: 180000, // 3分钟
      });

      console.log('');
      CLIOutput.subtitle('Claude 响应:');
      console.log(result.output);
      console.log('');

      CLIOutput.keyValue('耗时', `${result.duration}ms`);
    } catch (error) {
      CLIOutput.error(`执行失败: ${error}`);
    }
  });

// 注册 YouTube 命令
registerYouTubeCommands(program);

program.parse();
