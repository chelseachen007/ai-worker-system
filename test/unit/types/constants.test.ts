/**
 * 常量测试
 */
import { describe, it, expect } from 'vitest';
import {
  canTransition,
  getStatusColor,
  getStatusLabel,
  isTerminalStatus,
  isFailedStatus,
  PROJECT_SCOPE_LABELS,
  STATUS_LABELS,
} from '@/types/constants';

describe('状态转换规则', () => {
  describe('Clarification 状态转换', () => {
    it('应该允许 pending → processing', () => {
      expect(canTransition('pending', 'processing', 'clarification')).toBe(true);
    });

    it('应该允许 processing → awaiting', () => {
      expect(canTransition('processing', 'awaiting', 'clarification')).toBe(true);
    });

    it('应该允许 awaiting → confirmed', () => {
      expect(canTransition('awaiting', 'confirmed', 'clarification')).toBe(true);
    });

    it('应该拒绝 confirmed → pending (终态)', () => {
      expect(canTransition('confirmed', 'pending', 'clarification')).toBe(false);
    });

    it('应该允许 failed → pending (重试)', () => {
      expect(canTransition('failed', 'pending', 'clarification')).toBe(true);
    });
  });

  describe('Feedback 状态转换', () => {
    it('应该允许 pending → analyzing', () => {
      expect(canTransition('pending', 'analyzing', 'feedback')).toBe(true);
    });

    it('应该允许 analyzing → executing', () => {
      expect(canTransition('analyzing', 'executing', 'feedback')).toBe(true);
    });

    it('应该允许 executing → completed', () => {
      expect(canTransition('executing', 'completed', 'feedback')).toBe(true);
    });

    it('应该拒绝 completed → pending (终态)', () => {
      expect(canTransition('completed', 'pending', 'feedback')).toBe(false);
    });

    it('应该允许 failed → pending (重试)', () => {
      expect(canTransition('failed', 'pending', 'feedback')).toBe(true);
    });
  });

  describe('Task 状态转换', () => {
    it('应该允许 pending → in_progress', () => {
      expect(canTransition('pending', 'in_progress', 'task')).toBe(true);
    });

    it('应该允许 in_progress → completed', () => {
      expect(canTransition('in_progress', 'completed', 'task')).toBe(true);
    });

    it('应该允许 in_progress → failed', () => {
      expect(canTransition('in_progress', 'failed', 'task')).toBe(true);
    });

    it('应该拒绝 completed → in_progress (终态)', () => {
      expect(canTransition('completed', 'in_progress', 'task')).toBe(false);
    });

    it('应该允许 failed → pending (重试)', () => {
      expect(canTransition('failed', 'pending', 'task')).toBe(true);
    });
  });
});

describe('状态工具函数', () => {
  it('应该正确获取状态颜色', () => {
    expect(getStatusColor('pending')).toBe('yellow');
    expect(getStatusColor('completed')).toBe('green');
    expect(getStatusColor('failed')).toBe('red');
  });

  it('应该正确获取状态标签', () => {
    expect(getStatusLabel('pending')).toBe('等待中');
    expect(getStatusLabel('processing')).toBe('处理中');
    expect(getStatusLabel('completed')).toBe('已完成');
  });

  it('应该正确判断终态', () => {
    expect(isTerminalStatus('confirmed')).toBe(true);
    expect(isTerminalStatus('cancelled')).toBe(true);
    expect(isTerminalStatus('expired')).toBe(true);
    expect(isTerminalStatus('completed')).toBe(true);
    expect(isTerminalStatus('pending')).toBe(false);
  });

  it('应该正确判断失败状态', () => {
    expect(isFailedStatus('failed')).toBe(true);
    expect(isFailedStatus('expired')).toBe(true);
    expect(isFailedStatus('pending')).toBe(false);
  });
});

describe('项目范围标签', () => {
  it('应该有正确的项目范围标签', () => {
    expect(PROJECT_SCOPE_LABELS.backend).toBe('后端项目');
    expect(PROJECT_SCOPE_LABELS.frontend).toBe('前端项目');
    expect(PROJECT_SCOPE_LABELS.fullstack).toBe('全栈（前后端）');
  });
});

describe('状态标签', () => {
  it('应该有所有必需的状态标签', () => {
    const requiredStatuses = [
      'pending',
      'processing',
      'awaiting',
      'confirmed',
      'cancelled',
      'expired',
      'failed',
      'analyzing',
      'executing',
      'completed',
      'in_progress',
    ];

    for (const status of requiredStatuses) {
      expect(STATUS_LABELS[status]).toBeDefined();
      expect(typeof STATUS_LABELS[status]).toBe('string');
    }
  });
});
