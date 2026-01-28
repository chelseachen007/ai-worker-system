import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';

/**
 * 获取项目根目录
 */
export function getRootDir(): string {
  return process.cwd();
}

/**
 * 获取存储目录
 */
export function getStorageDir(...paths: string[]): string {
  return path.join(getRootDir(), 'storage', ...paths);
}

/**
 * 获取配置目录
 */
export function getConfigDir(...paths: string[]): string {
  return path.join(getRootDir(), 'config', ...paths);
}

/**
 * 获取日志目录
 */
export function getLogsDir(...paths: string[]): string {
  return path.join(getRootDir(), 'logs', ...paths);
}

/**
 * 获取反馈目录
 */
export function getFeedbacksDir(date: string, ...rest: string[]): string {
  const parts = ['feedbacks', date, ...rest];
  return path.join(getRootDir(), 'storage', ...parts);
}

/**
 * 获取 SDD 目录
 */
export function getSDDDir(date: string, feedbackId: string): string {
  return getFeedbacksDir(date, feedbackId, 'sdd');
}

/**
 * 获取调试目录
 */
export function getDebugDir(date: string, feedbackId: string): string {
  return getFeedbacksDir(date, feedbackId, 'debug');
}

/**
 * 获取 prompts 目录
 */
export function getPromptsDir(date: string, feedbackId: string): string {
  return getFeedbacksDir(date, feedbackId, 'debug', 'prompts');
}

/**
 * 确保目录存在
 */
export async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * 确保多个目录存在
 */
export async function ensureDirs(dirPaths: string[]): Promise<void> {
  await Promise.all(dirPaths.map(ensureDir));
}

/**
 * 读取 JSON 文件
 */
export async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * 写入 JSON 文件（原子写入）
 */
export async function writeJSON<T>(filePath: string, data: T): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

/**
 * 读取文本文件
 */
export async function readText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * 写入文本文件（原子写入）
 */
export async function writeText(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, content, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

/**
 * 追加写入文本文件
 */
export async function appendText(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await fs.appendFile(filePath, content, 'utf-8');
}

/**
 * 删除文件
 */
export async function removeFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // 忽略不存在的文件
  }
}

/**
 * 删除目录
 */
export async function removeDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // 忽略错误
  }
}

/**
 * 列出目录内容
 */
export async function listDir(dirPath: string): Promise<string[]> {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

/**
 * 检查文件是否存在
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * 检查是否为目录
 */
export async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
