import type { Clarification, ClarificationQuestion, ClarificationSummary, Feedback } from '../types/index.js';
import {
  loadFeedback,
  saveFeedback,
  savePrompt,
  saveResponse,
  appendLog,
  generateFeedbackId,
  listFeedbacksByDate,
  updateFeedbackStatus,
} from '../storage/index.js';
import { aiAdapter } from '../executors/ai-adapter.js';

/**
 * Clarification 超时时间（毫秒）
 * 默认 24 小时
 */
const CLARIFICATION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

/**
 * Clarification Handler
 * 处理需求澄清流程
 */
export class ClarificationHandler {
  /**
   * 分析用户输入，判断是否需要澄清
   */
  async analyze(clarificationId: string): Promise<{
    needsClarification: boolean;
    summary?: ClarificationSummary;
    questions?: ClarificationQuestion[];
  }> {
    const clarification = await loadFeedback(clarificationId) as Clarification;
    if (!clarification) {
      throw new Error(`Clarification not found: ${clarificationId}`);
    }

    await appendLog(clarificationId, `开始分析用户输入: ${clarification.userInput.slice(0, 50)}...`);

    // 构建分析 Prompt
    const prompt = this.buildAnalysisPrompt(clarification);
    await savePrompt(clarificationId, 'analysis', prompt);

    try {
      // 调用 AI 分析
      const result = await aiAdapter.execute(prompt, {
        timeout: 120000, // 2分钟
      });

      await saveResponse(clarificationId, 'analysis', result.output);
      await appendLog(clarificationId, `AI 分析完成，响应长度: ${result.output.length}`);

      // 解析 AI 响应
      const parsed = this.parseAnalysisResponse(result.output);
      await appendLog(clarificationId, `需要澄清: ${parsed.needsClarification}`);

      return parsed;
    } catch (error) {
      await appendLog(clarificationId, `分析失败: ${error}`, 'error');

      // 失败时使用简单的默认分析
      return this.fallbackAnalysis(clarification.userInput);
    }
  }

  /**
   * 构建分析 Prompt
   */
  private buildAnalysisPrompt(clarification: Clarification): string {
    const lines: string[] = [];

    lines.push('你是需求分析助手。你的任务是判断用户需求是否足够清晰，可以直接进入开发。');
    lines.push('');

    lines.push('## 用户需求');
    lines.push(clarification.userInput);
    lines.push('');

    lines.push('## 项目范围');
    lines.push(clarification.projectScope === 'backend' ? '后端项目' :
               clarification.projectScope === 'frontend' ? '前端项目' : '全栈项目');
    lines.push('');

    lines.push('## 你的任务');
    lines.push('1. 分析用户需求，提取功能目标');
    lines.push('2. 定义验收标准');
    lines.push('3. 判断需求是否清晰，是否有歧义');
    lines.push('4. 如果有歧义，生成澄清问题');
    lines.push('');

    lines.push('## 输出格式');
    lines.push('请严格按照以下 JSON 格式输出，不要包含任何其他文字：');
    lines.push('');
    lines.push('```json');
    lines.push('{');
    lines.push('  "needsClarification": true,');
    lines.push('  "summary": "需求摘要（一句话）",');
    lines.push('  "goals": ["目标1", "目标2", "目标3"],');
    lines.push('  "acceptanceCriteria": ["验收标准1", "验收标准2", "验收标准3"],');
    lines.push('  "ambiguity": ["歧义点1", "歧义点2"],');
    lines.push('  "questions": [');
    lines.push('    {');
    lines.push('      "id": "q1",');
    lines.push('      "question": "问题内容？",');
    lines.push('      "options": ["选项A", "选项B", "选项C"],');
    lines.push('      "required": true');
    lines.push('    }');
    lines.push('  ]');
    lines.push('}');
    lines.push('```');
    lines.push('');
    lines.push('注意：');
    lines.push('- needsClarification: 如果需求不够清晰，需要用户补充信息，则为 true');
    lines.push('- goals: 至少 2-3 个功能目标');
    lines.push('- acceptanceCriteria: 至少 2-3 个验收标准');
    lines.push('- questions: 如果 needsClarification 为 true，生成 1-3 个澄清问题');

    return lines.join('\n');
  }

  /**
   * 解析 AI 分析响应
   */
  private parseAnalysisResponse(response: string): {
    needsClarification: boolean;
    summary?: ClarificationSummary;
    questions?: ClarificationQuestion[];
  } {
    try {
      // 提取 JSON
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                       response.match(/```\s*([\s\S]*?)\s*```/) ||
                       response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      return {
        needsClarification: parsed.needsClarification || false,
        summary: {
          summary: parsed.summary,
          goals: parsed.goals || [],
          acceptanceCriteria: parsed.acceptanceCriteria || [],
          ambiguity: parsed.ambiguity || [],
        },
        questions: parsed.questions || [],
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      // 返回默认值
      return {
        needsClarification: true,
        summary: {
          goals: ['分析需求'],
          acceptanceCriteria: ['功能正常工作'],
          ambiguity: [],
        },
        questions: [],
      };
    }
  }

  /**
   * 失败时的简单分析
   */
  private fallbackAnalysis(userInput: string): {
    needsClarification: boolean;
    summary?: ClarificationSummary;
    questions?: ClarificationQuestion[];
  } {
    const needsClarification = userInput.length < 20;

    const summary: ClarificationSummary = {
      summary: userInput.slice(0, 50),
      goals: [
        '理解并实现用户需求',
        '确保代码质量符合规范',
        '添加必要的错误处理',
      ],
      acceptanceCriteria: [
        '功能按预期工作',
        '代码符合项目规范',
        '有适当的错误处理',
        '有必要的测试',
      ],
      ambiguity: [],
    };

    const questions: ClarificationQuestion[] = [];

    if (needsClarification) {
      questions.push({
        id: 'q1',
        question: '能否提供更多关于需求的细节？',
        options: ['我可以补充更多细节', '当前描述已经足够'],
        required: true,
      });
    }

    return {
      needsClarification,
      summary,
      questions: questions.length > 0 ? questions : undefined,
    };
  }

  /**
   * 确认澄清问题
   */
  async confirm(clarificationId: string, answers: Record<string, string>): Promise<boolean> {
    const clarification = await loadFeedback(clarificationId) as Clarification;
    if (!clarification) {
      throw new Error(`Clarification not found: ${clarificationId}`);
    }

    await appendLog(clarificationId, `用户确认，答案: ${JSON.stringify(answers)}`);

    // 更新问题答案
    if (clarification.questions) {
      clarification.questions.forEach((q) => {
        if (answers[q.id]) {
          q.answer = answers[q.id];
        }
      });
    }

    // 更新状态为 confirmed
    (clarification as any).status = 'confirmed';
    clarification.updatedAt = new Date().toISOString();
    await saveFeedback(clarification);

    await appendLog(clarificationId, '澄清已确认，可以创建 Feedback');

    return true;
  }

  /**
   * 创建关联的 Feedback
   */
  async createFeedback(clarificationId: string): Promise<string> {
    const clarification = await loadFeedback(clarificationId) as Clarification;
    if (!clarification) {
      throw new Error(`Clarification not found: ${clarificationId}`);
    }

    if (clarification.status !== 'confirmed') {
      throw new Error('Clarification must be confirmed first');
    }

    const feedbackId = generateFeedbackId();

    const feedback: Feedback = {
      id: feedbackId,
      type: 'feedback',
      status: 'pending',
      userInput: clarification.userInput,
      projectScope: clarification.projectScope,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      summary: clarification.summary,
      confirmationId: clarificationId,
    };

    await saveFeedback(feedback);
    await appendLog(clarificationId, `创建关联 Feedback: ${feedbackId}`);
    await appendLog(feedbackId, `从 Clarification ${clarificationId} 创建`);

    return feedbackId;
  }

  /**
   * 处理超时的澄清
   */
  async checkExpired(): Promise<string[]> {
    const expiredIds: string[] = [];
    const now = Date.now();

    // 检查今天的反馈
    const feedbacks = await listFeedbacksByDate(new Date().toISOString().slice(0, 10));

    for (const feedback of feedbacks) {
      if (feedback.type !== 'clarification') {
        continue;
      }

      const clarification = feedback as Clarification;

      // 只检查 pending 和 awaiting 状态
      if (clarification.status !== 'pending' && clarification.status !== 'awaiting') {
        continue;
      }

      // 检查是否超时
      const createdAt = new Date(clarification.createdAt).getTime();
      if (now - createdAt > CLARIFICATION_TIMEOUT_MS) {
        expiredIds.push(clarification.id);
      }
    }

    return expiredIds;
  }
}

/**
 * 处理待处理的 Clarification
 */
export async function processPendingClarifications(): Promise<void> {
  const handler = new ClarificationHandler();

  // 检查超时的澄清
  const expiredIds = await handler.checkExpired();
  for (const id of expiredIds) {
    await updateFeedbackStatus(id, 'expired');
    await appendLog(id, '澄清已超时', 'warn');
  }

  // 获取待处理的 clarifications（从今天的反馈中筛选）
  const feedbacks = await listFeedbacksByDate(new Date().toISOString().slice(0, 10));
  const pendingClarifications = feedbacks.filter(
    (f): f is Clarification =>
      f.type === 'clarification' &&
      (f.status === 'pending' || f.status === 'processing')
  );

  // 逐个处理
  for (const clarification of pendingClarifications) {
    try {
      // 更新状态为 processing
      await updateFeedbackStatus(clarification.id, 'processing');

      // 分析
      const result = await handler.analyze(clarification.id);

      // 根据分析结果更新状态
      if (result.needsClarification && result.questions && result.questions.length > 0) {
        // 需要用户澄清 - 保存问题和摘要
        const updated = await loadFeedback(clarification.id) as Clarification;
        if (updated) {
          updated.summary = result.summary;
          updated.questions = result.questions;
          await saveFeedback(updated);
        }
        await updateFeedbackStatus(clarification.id, 'awaiting');
      } else {
        // 可以直接进入开发阶段
        const updated = await loadFeedback(clarification.id) as Clarification;
        if (updated) {
          updated.summary = result.summary;
          await saveFeedback(updated);
        }
        await updateFeedbackStatus(clarification.id, 'confirmed');
      }
    } catch (error) {
      await appendLog(clarification.id, `处理失败: ${error}`, 'error');
      await updateFeedbackStatus(clarification.id, 'failed');
    }
  }
}
