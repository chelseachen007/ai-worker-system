/**
 * 任务执行器测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskExecutor } from '@/executors/task-executor';
import { TaskStateMachine } from '@/core/state-machine';
import type { ExecutableTask } from '@/types';

// Mock 依赖
vi.mock('@/storage/index.js', () => ({
  appendLog: vi.fn(),
}));

vi.mock('@/executors/ai-adapter.js', () => ({
  aiAdapter: {
    execute: vi.fn(),
  },
}));

describe('TaskExecutor', () => {
  let executor: TaskExecutor;
  const mockFeedbackId = 'test-feedback-123';

  beforeEach(() => {
    executor = new TaskExecutor();
    vi.clearAllMocks();
  });

  const createMockTasks = (): ExecutableTask[] => [
    {
      id: 'task-1',
      title: 'Backend Task 1',
      description: 'First backend task',
      files: ['src/file1.ts'],
      project: 'backend',
      dependsOn: [],
      status: 'pending',
    },
    {
      id: 'task-2',
      title: 'Backend Task 2',
      description: 'Second backend task',
      files: ['src/file2.ts'],
      project: 'backend',
      dependsOn: ['task-1'],
      status: 'pending',
    },
    {
      id: 'task-3',
      title: 'Frontend Task 1',
      description: 'First frontend task',
      files: ['src/file3.ts'],
      project: 'frontend',
      dependsOn: [],
      status: 'pending',
    },
  ];

  describe('任务分组', () => {
    it('应该正确按项目分组任务', () => {
      const tasks = createMockTasks();

      // 通过私有方法测试（在 TypeScript 中需要类型断言）
      const executorInstance = executor as any;
      const groups = executorInstance.groupTasksByProject(tasks);

      expect(groups.backend).toHaveLength(2);
      expect(groups.frontend).toHaveLength(1);
      expect(groups.backend[0].id).toBe('task-1');
      expect(groups.frontend[0].id).toBe('task-3');
    });
  });

  describe('依赖排序', () => {
    it('应该正确按依赖顺序排序任务', () => {
      const tasks = createMockTasks();

      const executorInstance = executor as any;
      const sorted = executorInstance.sortTasksByDependency(tasks);

      // task-1 应该在 task-2 之前
      const task1Index = sorted.findIndex((t: ExecutableTask) => t.id === 'task-1');
      const task2Index = sorted.findIndex((t: ExecutableTask) => t.id === 'task-2');

      expect(task1Index).toBeLessThan(task2Index);
    });

    it('应该正确处理无依赖的任务', () => {
      const tasks: ExecutableTask[] = [
        {
          id: 'task-a',
          title: 'Task A',
          description: 'No dependencies',
          files: [],
          project: 'backend',
          dependsOn: [],
          status: 'pending',
        },
      ];

      const executorInstance = executor as any;
      const sorted = executorInstance.sortTasksByDependency(tasks);

      expect(sorted).toHaveLength(1);
      expect(sorted[0].id).toBe('task-a');
    });
  });

  describe('依赖检查', () => {
    it('应该正确检查任务依赖是否完成', () => {
      const tasks: ExecutableTask[] = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Completed',
          files: [],
          project: 'backend',
          dependsOn: [],
          status: 'completed',
        },
        {
          id: 'task-2',
          title: 'Task 2',
          description: 'Pending',
          files: [],
          project: 'backend',
          dependsOn: ['task-1'],
          status: 'pending',
        },
      ];

      const executorInstance = executor as any;
      const canExecute = executorInstance.checkDependencies(tasks[1], tasks);

      expect(canExecute).toBe(true);
    });

    it('应该拒绝依赖未完成的任务', () => {
      const tasks: ExecutableTask[] = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Pending',
          files: [],
          project: 'backend',
          dependsOn: [],
          status: 'pending',
        },
        {
          id: 'task-2',
          title: 'Task 2',
          description: 'Depends on task-1',
          files: [],
          project: 'backend',
          dependsOn: ['task-1'],
          status: 'pending',
        },
      ];

      const executorInstance = executor as any;
      const canExecute = executorInstance.checkDependencies(tasks[1], tasks);

      expect(canExecute).toBe(false);
    });
  });

  describe('Prompt 构建', () => {
    it('应该正确构建任务执行 Prompt', () => {
      const task: ExecutableTask = {
        id: 'task-1',
        title: 'Implement Feature',
        description: 'Implement a new feature',
        files: ['src/feature.ts'],
        project: 'backend',
        dependsOn: ['task-0'],
        status: 'pending',
      };

      const executorInstance = executor as any;
      const prompt = executorInstance.buildTaskPrompt(task);

      expect(prompt).toContain('Implement Feature');
      expect(prompt).toContain('Implement a new feature');
      expect(prompt).toContain('src/feature.ts');
      expect(prompt).toContain('task-0');
    });
  });

  describe('状态机集成', () => {
    it('应该正确判断任务是否可以开始', () => {
      const sm1 = new TaskStateMachine('pending');
      expect(sm1.canStart()).toBe(true);

      const sm2 = new TaskStateMachine('in_progress');
      expect(sm2.canStart()).toBe(false);
    });
  });
});
