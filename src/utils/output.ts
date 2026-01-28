import chalk from 'chalk';
import { getStatusColor, getStatusLabel, PROJECT_SCOPE_LABELS } from '../types/constants.js';

/**
 * CLI 输出工具
 */
export class CLIOutput {
  /**
   * 成功消息
   */
  static success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  /**
   * 错误消息
   */
  static error(message: string): void {
    console.error(chalk.red('✗'), message);
  }

  /**
   * 警告消息
   */
  static warn(message: string): void {
    console.warn(chalk.yellow('⚠'), message);
  }

  /**
   * 信息消息
   */
  static info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  /**
   * 标题
   */
  static title(message: string): void {
    console.log('');
    console.log(chalk.bold.cyan(`\n${'='.repeat(50)}`));
    console.log(chalk.bold.cyan(message));
    console.log(chalk.bold.cyan(`${'='.repeat(50)}\n`));
  }

  /**
   * 副标题
   */
  static subtitle(message: string): void {
    console.log('');
    console.log(chalk.bold(message));
    console.log(chalk.gray('─'.repeat(message.length)));
  }

  /**
   * 状态徽章
   */
  static badge(text: string, color: string = 'blue'): string {
    const colors: Record<string, (text: string) => string> = {
      gray: chalk.gray,
      red: chalk.red,
      green: chalk.green,
      yellow: chalk.yellow,
      blue: chalk.blue,
      cyan: chalk.cyan,
      magenta: chalk.magenta,
      white: chalk.white,
    };
    const fn = colors[color] || chalk.white;
    return fn(`[${text}]`);
  }

  /**
   * 格式化状态
   */
  static status(status: string): string {
    const color = getStatusColor(status);
    const label = getStatusLabel(status);
    const colors: Record<string, (text: string) => string> = {
      gray: chalk.gray,
      red: chalk.red,
      green: chalk.green,
      yellow: chalk.yellow,
      blue: chalk.blue,
      cyan: chalk.cyan,
      magenta: chalk.magenta,
      white: chalk.white,
    };
    const fn = colors[color] || chalk.white;
    return fn(label);
  }

  /**
   * 格式化日期
   */
  static date(dateStr: string): string {
    const date = new Date(dateStr);
    return chalk.gray(date.toLocaleString('zh-CN'));
  }

  /**
   * 格式化项目范围
   */
  static projectScope(scope: string): string {
    return chalk.magenta(PROJECT_SCOPE_LABELS[scope] || scope);
  }

  /**
   * 进度条
   */
  static progress(current: number, total: number, width: number = 30): string {
    const percent = Math.min(1, Math.max(0, current / total));
    const filled = Math.round(width * percent);
    const empty = width - filled;
    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    return `${bar} ${current}/${total}`;
  }

  /**
   * 表格行
   */
  static row(cells: string[], widths: number[]): void {
    const parts = cells.map((cell, i) => {
      const width = widths[i] || 20;
      const truncated = cell.length > width ? cell.slice(0, width - 3) + '...' : cell;
      return truncated.padEnd(width);
    });
    console.log(parts.join(' '));
  }

  /**
   * 表格分隔线
   */
  static separator(widths: number[]): void {
    const parts = widths.map((w) => '─'.repeat(w));
    console.log(parts.join('─'));
  }

  /**
   * 代码块
   */
  static code(code: string, language: string = ''): void {
    console.log('');
    if (language) {
      console.log(chalk.gray(`// ${language}`));
    }
    console.log(chalk.gray(code));
    console.log('');
  }

  /**
   * 引用
   */
  static quote(text: string): void {
    const lines = text.split('\n');
    console.log('');
    lines.forEach((line) => {
      console.log(chalk.gray('│ ') + line);
    });
    console.log('');
  }

  /**
   * 列表
   */
  static list(items: string[], indent: number = 0): void {
    const prefix = '  '.repeat(indent);
    items.forEach((item) => {
      console.log(prefix + chalk.gray('•') + ' ' + item);
    });
  }

  /**
   * 复选框
   */
  static checkbox(checked: boolean, label: string): void {
    const symbol = checked ? chalk.green('☑') : chalk.gray('☐');
    console.log(`${symbol} ${label}`);
  }

  /**
   * 键值对
   */
  static keyValue(key: string, value: string): void {
    console.log(`${chalk.cyan(key)}: ${value}`);
  }

  /**
   * 空行
   */
  static newline(): void {
    console.log('');
  }

  /**
   * 分隔线
   */
  static divider(): void {
    console.log(chalk.gray('─'.repeat(50)));
  }
}
