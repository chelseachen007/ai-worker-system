/**
 * 文件系统测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getRootDir,
  getStorageDir,
  getConfigDir,
  getLogsDir,
  getFeedbacksDir,
  getSDDDir,
  getDebugDir,
  getPromptsDir,
  ensureDir,
  readJSON,
  writeJSON,
  readText as fsReadText,
  writeText,
  appendText,
  listDir,
} from '@/storage/filesystem';
import { parseFeedbackDate, generateFeedbackId, getTodayDate } from '@/storage/index';

describe('路径函数', () => {
  it('应该正确获取根目录', () => {
    const rootDir = getRootDir();
    expect(rootDir).toBe(process.cwd());
  });

  it('应该正确获取存储目录', () => {
    const storageDir = getStorageDir('feedbacks', '2024-01-01');
    expect(storageDir).toContain('storage');
    expect(storageDir).toContain('feedbacks');
    expect(storageDir).toContain('2024-01-01');
  });

  it('应该正确获取配置目录', () => {
    const configDir = getConfigDir('projects.json');
    expect(configDir).toContain('config');
    expect(configDir).toContain('projects.json');
  });

  it('应该正确获取日志目录', () => {
    const logsDir = getLogsDir('app.log');
    expect(logsDir).toContain('logs');
    expect(logsDir).toContain('app.log');
  });

  it('应该正确获取反馈目录', () => {
    const feedbacksDir = getFeedbacksDir('2024-01-01', 'feedback-123');
    expect(feedbacksDir).toContain('storage');
    expect(feedbacksDir).toContain('feedbacks');
    expect(feedbacksDir).toContain('2024-01-01');
    expect(feedbacksDir).toContain('feedback-123');
  });

  it('应该正确获取 SDD 目录', () => {
    const sddDir = getSDDDir('2024-01-01', 'feedback-123');
    expect(sddDir).toContain('sdd');
  });

  it('应该正确获取调试目录', () => {
    const debugDir = getDebugDir('2024-01-01', 'feedback-123');
    expect(debugDir).toContain('debug');
  });

  it('应该正确获取 prompts 目录', () => {
    const promptsDir = getPromptsDir('2024-01-01', 'feedback-123');
    expect(promptsDir).toContain('prompts');
  });
});

describe('反馈 ID 函数', () => {
  it('应该正确解析反馈日期', () => {
    const feedbackId = '20240101-120000-abc12';
    const date = parseFeedbackDate(feedbackId);
    expect(date).toBe('2024-01-01');
  });

  it('应该正确获取今天日期', () => {
    const today = getTodayDate();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('应该生成唯一的反馈 ID', () => {
    const id1 = generateFeedbackId();
    const id2 = generateFeedbackId();

    expect(id1).toMatch(/^\d{8}-\d{6}-[a-z0-9]{5}$/);
    expect(id2).toMatch(/^\d{8}-\d{6}-[a-z0-9]{5}$/);
    expect(id1).not.toBe(id2);
  });
});

describe('文件操作', () => {
  const testDir = 'storage/test-temp';
  const testFile = `${testDir}/test.json`;

  beforeEach(async () => {
    // 清理测试目录
    await ensureDir(testDir);
  });

  afterEach(async () => {
    // 测试后清理
    // 注意：这里简化处理，实际应该删除测试目录
  });

  it('应该正确写入和读取 JSON', async () => {
    const testData = { foo: 'bar', num: 123 };

    await writeJSON(testFile, testData);
    const readData = await readJSON(testFile);

    expect(readData).toEqual(testData);
  });

  it('应该正确处理不存在的文件', async () => {
    const data = await readJSON('non-existent/file.json');
    expect(data).toBeNull();
  });

  it('应该正确写入和读取文本', async () => {
    const testText = 'Hello, World!';
    const textFile = `${testDir}/text.txt`;

    await writeText(textFile, testText);
    const readContent = await fsReadText(textFile);

    expect(readContent).toBe(testText);
  });

  it('应该正确追加文本', async () => {
    const appendFile = `${testDir}/append.txt`;
    const line1 = 'Line 1\n';
    const line2 = 'Line 2\n';

    await writeText(appendFile, line1);
    await appendText(appendFile, line2);

    const content = await fsReadText(appendFile);
    expect(content).toBe(line1 + line2);
  });

  it('应该正确列出目录内容', async () => {
    await writeText(`${testDir}/file1.txt`, 'content1');
    await writeText(`${testDir}/file2.txt`, 'content2');

    const files = await listDir(testDir);
    expect(files).toContain('file1.txt');
    expect(files).toContain('file2.txt');
  });

  it('应该正确处理空目录', async () => {
    const files = await listDir('non-existent-dir');
    expect(files).toEqual([]);
  });
});
