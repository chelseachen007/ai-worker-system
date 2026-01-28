import { spawn } from 'node:child_process';
import type { ToolStatus, ExecuteResult } from '../types/index.js';
import { loadToolStatus, updateToolStatus, loadToolsConfig } from '../storage/index.js';

/**
 * 配额错误检测正则
 */
const QUOTA_PATTERNS = [
  /quota/i,
  /limit/i,
  /rate limit/i,
  /insufficient/i,
  /credits/i,
  /401/,
  /403/,
  /429/,
  /API key/i,
  /authentication/i,
];

/**
 * 检查是否为配额错误
 */
export function isQuotaError(output: string): boolean {
  return QUOTA_PATTERNS.some((pattern) => pattern.test(output));
}

/**
 * Claude Code CLI 适配器
 * 专门处理 Claude Code CLI 的调用
 */
export class ClaudeCodeAdapter {
  private command: string;
  private baseArgs: string[];

  constructor(command: string = 'claude', args: string[] = []) {
    this.command = command;
    this.baseArgs = args;
  }

  /**
   * 调用 Claude Code CLI
   */
  async execute(prompt: string, options?: {
    cwd?: string;
    timeout?: number;
  }): Promise<ExecuteResult> {
    const startTime = Date.now();
    const { cwd = process.cwd(), timeout = 300000 } = options || {};

    try {
      const output = await this.execCommand(prompt, { cwd, timeout });

      return {
        exitCode: 0,
        output,
        duration: Date.now() - startTime,
        tool: 'claude',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        exitCode: 1,
        output: '',
        error: errorMessage,
        duration: Date.now() - startTime,
        tool: 'claude',
      };
    }
  }

  /**
   * 执行命令
   */
  private execCommand(
    prompt: string,
    options: { cwd?: string; timeout?: number }
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';

      // 构建参数数组
      const args = [
        '-p',
        prompt,
        '--permission-mode', 'bypassPermissions',
        '--no-session-persistence',
        ...this.baseArgs,
      ];

      const proc = spawn(this.command, args, {
        cwd: options.cwd || process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      // 设置超时
      if (options.timeout) {
        const timer = setTimeout(() => {
          proc.kill('SIGTERM');
          reject(new Error(`Command timeout after ${options.timeout}ms`));
        }, options.timeout);
        proc.on('close', () => clearTimeout(timer));
      }

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          const errorMsg = errorOutput || output || `Command failed with code ${code}`;
          reject(new Error(errorMsg));
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 测试 Claude CLI 是否可用
   */
  async test(): Promise<boolean> {
    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';

      // 使用 --version 测试
      const proc = spawn(this.command, ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 && output.includes('Claude')) {
          console.log(`Claude CLI version: ${output.trim()}`);
          resolve(true);
        } else {
          resolve(false);
        }
      });

      proc.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }
}

/**
 * AI CLI 适配器
 * 支持多个 AI 工具，自动失败切换
 */
export class AICliAdapter {
  private failureCooldownMs: number = 5 * 60 * 1000; // 5分钟
  private adapters: Map<string, ClaudeCodeAdapter> = new Map();

  constructor() {
    // 初始化 Claude 适配器
    this.adapters.set('claude', new ClaudeCodeAdapter('claude', []));
  }

  /**
   * 执行 AI 命令
   */
  async execute(
    prompt: string,
    options?: {
      preferredTool?: string;
      cwd?: string;
      timeout?: number;
    }
  ): Promise<ExecuteResult> {
    const config = await loadToolsConfig();
    if (!config) {
      throw new Error('Tools config not found');
    }

    this.failureCooldownMs = config.failureCooldownMs;

    // 获取可用工具列表
    const toolPool = await this.getOrderedToolPool();

    if (toolPool.length === 0) {
      throw new Error('No available AI tools. Please check your configuration.');
    }

    let lastError: string | undefined;

    for (const tool of toolPool) {
      // 如果指定了首选工具，只使用该工具
      if (options?.preferredTool && tool.name !== options.preferredTool) {
        continue;
      }

      const adapter = this.adapters.get(tool.name);
      if (!adapter) {
        console.warn(`Adapter not found for tool: ${tool.name}`);
        continue;
      }

      console.log(`[AI] Using ${tool.name}...`);

      try {
        const result = await adapter.execute(prompt, {
          cwd: options?.cwd,
          timeout: options?.timeout,
        });

        if (result.exitCode === 0) {
          // 成功
          await this.markSuccess(tool.name, result.duration);
          console.log(`[AI] ${tool.name} completed in ${result.duration}ms`);
          return result;
        }

        // 失败
        lastError = result.error || result.output;
        const isQuota = isQuotaError(result.output) || isQuotaError(lastError || '');

        await this.markFailed(tool.name, isQuota ? 'quota' : 'error');

        if (isQuota) {
          console.warn(`[AI] ${tool.name} quota exceeded, trying next tool...`);
        } else {
          console.error(`[AI] ${tool.name} failed: ${lastError}`);
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        await this.markFailed(tool.name, 'error');
        console.error(`[AI] ${tool.name} error: ${lastError}`);
        break;
      }
    }

    throw new Error(`All tools failed. Last error: ${lastError}`);
  }

  /**
   * 获取按可用性排序的工具池
   */
  private async getOrderedToolPool(): Promise<ToolStatus[]> {
    const config = await loadToolsConfig();
    if (!config) return [];

    const statuses = await loadToolStatus();
    const statusMap = new Map(statuses.map((s) => [s.name, s]));

    const now = Date.now();
    const tools: ToolStatus[] = [];

    for (const toolConfig of config.tools) {
      if (!toolConfig.enabled) continue;

      const status = statusMap.get(toolConfig.name) || {
        name: toolConfig.name,
        available: true,
        failureCount: 0,
      };

      // 检查是否在冷却期
      if (status.lastFailed && now - (status.lastFailed || 0) < this.failureCooldownMs) {
        status.available = false;
      }

      tools.push(status);
    }

    // 按优先级排序，然后按可用性，最后按响应时间
    return tools.sort((a, b) => {
      const configA = config.tools.find((t) => t.name === a.name);
      const configB = config.tools.find((t) => t.name === b.name);
      const priorityA = configA?.priority || 999;
      const priorityB = configB?.priority || 999;

      if (a.available !== b.available) {
        return a.available ? -1 : 1;
      }

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return (a.responseTimeMs || Infinity) - (b.responseTimeMs || Infinity);
    });
  }

  /**
   * 标记工具成功
   */
  private async markSuccess(toolName: string, responseTimeMs: number): Promise<void> {
    await updateToolStatus(toolName, {
      available: true,
      lastSuccess: Date.now(),
      responseTimeMs,
      failureCount: 0,
    });
  }

  /**
   * 标记工具失败
   */
  private async markFailed(toolName: string, reason: string): Promise<void> {
    const statuses = await loadToolStatus();
    const tool = statuses.find((t) => t.name === toolName);

    const failureCount = (tool?.failureCount || 0) + 1;

    await updateToolStatus(toolName, {
      available: reason !== 'quota', // 配额错误时标记为不可用
      lastFailed: Date.now(),
      failureCount,
    });
  }

  /**
   * 检查工具是否可用
   */
  async isToolAvailable(toolName: string): Promise<boolean> {
    const statuses = await loadToolStatus();
    const tool = statuses.find((t) => t.name === toolName);

    if (!tool) return true; // 新工具默认可用
    if (!tool.available) return false;

    // 检查是否在冷却期
    if (tool.lastFailed && Date.now() - tool.lastFailed < this.failureCooldownMs) {
      return false;
    }

    return true;
  }

  /**
   * 获取默认工具
   */
  async getDefaultTool(): Promise<string> {
    const config = await loadToolsConfig();
    return config?.defaultTool || 'claude';
  }

  /**
   * 测试 Claude CLI
   */
  async testClaude(): Promise<boolean> {
    const adapter = this.adapters.get('claude');
    if (!adapter) return false;
    return await adapter.test();
  }
}

// 导出单例
export const aiAdapter = new AICliAdapter();
