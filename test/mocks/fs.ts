/**
 * 文件系统 Mock
 */
import { vi } from 'vitest';

export const mockFs = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn(),
  rename: vi.fn(),
  unlink: vi.fn(),
  rm: vi.fn(),
  stat: vi.fn(),
  existsSync: vi.fn(() => true),
};

export const mockPath = {
  join: vi.fn((...args: string[]) => args.join('/')),
  dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
};

export const setupMockFs = () => {
  vi.mock('node:fs/promises', () => ({
    default: mockFs,
    readFile: mockFs.readFile,
    writeFile: mockFs.writeFile,
    readdir: mockFs.readdir,
    mkdir: mockFs.mkdir,
    rename: mockFs.rename,
    unlink: mockFs.unlink,
    rm: mockFs.rm,
    stat: mockFs.stat,
  }));

  vi.mock('node:path', () => ({
    default: mockPath,
    join: mockPath.join,
    dirname: mockPath.dirname,
  }));

  vi.mock('node:fs', () => ({
    existsSync: mockFs.existsSync,
  }));
};
