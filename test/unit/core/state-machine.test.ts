/**
 * 状态机测试
 */
import { describe, it, expect } from 'vitest';
import {
  StateMachine,
  ClarificationStateMachine,
  FeedbackStateMachine,
  TaskStateMachine,
} from '@/core/state-machine';

describe('StateMachine', () => {
  it('应该正确获取当前状态', () => {
    const sm = new StateMachine('pending', 'task');
    expect(sm.getStatus()).toBe('pending');
  });

  it('应该正确转换状态', () => {
    const sm = new StateMachine('pending', 'task');
    const result = sm.transition('in_progress');
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('in_progress');
    expect(sm.getStatus()).toBe('in_progress');
  });

  it('应该拒绝非法状态转换', () => {
    const sm = new StateMachine('pending', 'task');
    const result = sm.transition('completed');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(sm.getStatus()).toBe('pending');
  });

  it('应该支持强制转换状态', () => {
    const sm = new StateMachine('pending', 'task');
    const result = sm.forceTransition('completed');
    expect(result.success).toBe(true);
    expect(sm.getStatus()).toBe('completed');
  });

  it('应该正确记录状态历史', () => {
    const sm = new StateMachine('pending', 'task');
    sm.transition('in_progress');
    sm.transition('completed');

    const history = sm.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0].status).toBe('pending');
    expect(history[1].status).toBe('in_progress');
    expect(history[2].status).toBe('completed');
  });

  it('应该正确判断终态', () => {
    const sm1 = new StateMachine('completed', 'task');
    expect(sm1.isTerminal()).toBe(true);

    const sm2 = new StateMachine('pending', 'task');
    expect(sm2.isTerminal()).toBe(false);
  });

  it('应该正确判断失败状态', () => {
    const sm1 = new StateMachine('failed', 'task');
    expect(sm1.isFailed()).toBe(true);

    const sm2 = new StateMachine('expired', 'clarification');
    expect(sm2.isFailed()).toBe(true);

    const sm3 = new StateMachine('pending', 'task');
    expect(sm3.isFailed()).toBe(false);
  });
});

describe('ClarificationStateMachine', () => {
  it('应该正确初始化状态', () => {
    const sm = new ClarificationStateMachine();
    expect(sm.getStatus()).toBe('pending');
  });

  it('应该支持完整的状态流转', () => {
    const sm = new ClarificationStateMachine();

    expect(sm.startProcessing().success).toBe(true);
    expect(sm.getStatus()).toBe('processing');

    expect(sm.awaitUser().success).toBe(true);
    expect(sm.getStatus()).toBe('awaiting');

    expect(sm.confirm().success).toBe(true);
    expect(sm.getStatus()).toBe('confirmed');
  });

  it('应该检查是否可以处理', () => {
    const sm1 = new ClarificationStateMachine('pending');
    expect(sm1.canProcess()).toBe(true);

    const sm2 = new ClarificationStateMachine('processing');
    expect(sm2.canProcess()).toBe(false);
  });

  it('应该检查是否需要确认', () => {
    const sm1 = new ClarificationStateMachine('awaiting');
    expect(sm1.needsConfirmation()).toBe(true);

    const sm2 = new ClarificationStateMachine('pending');
    expect(sm2.needsConfirmation()).toBe(false);
  });

  it('应该检查是否已确认', () => {
    const sm1 = new ClarificationStateMachine('confirmed');
    expect(sm1.isConfirmed()).toBe(true);

    const sm2 = new ClarificationStateMachine('awaiting');
    expect(sm2.isConfirmed()).toBe(false);
  });
});

describe('FeedbackStateMachine', () => {
  it('应该正确初始化状态', () => {
    const sm = new FeedbackStateMachine();
    expect(sm.getStatus()).toBe('pending');
  });

  it('应该支持完整的状态流转', () => {
    const sm = new FeedbackStateMachine();

    expect(sm.startAnalyzing().success).toBe(true);
    expect(sm.getStatus()).toBe('analyzing');

    expect(sm.startExecuting().success).toBe(true);
    expect(sm.getStatus()).toBe('executing');

    expect(sm.complete().success).toBe(true);
    expect(sm.getStatus()).toBe('completed');
  });

  it('应该检查是否可以分析', () => {
    const sm1 = new FeedbackStateMachine('pending');
    expect(sm1.canAnalyze()).toBe(true);

    const sm2 = new FeedbackStateMachine('analyzing');
    expect(sm2.canAnalyze()).toBe(false);
  });

  it('应该检查是否正在执行', () => {
    const sm1 = new FeedbackStateMachine('executing');
    expect(sm1.isExecuting()).toBe(true);

    const sm2 = new FeedbackStateMachine('analyzing');
    expect(sm2.isExecuting()).toBe(false);
  });

  it('应该检查是否已完成', () => {
    const sm1 = new FeedbackStateMachine('completed');
    expect(sm1.isCompleted()).toBe(true);

    const sm2 = new FeedbackStateMachine('executing');
    expect(sm2.isCompleted()).toBe(false);
  });
});

describe('TaskStateMachine', () => {
  it('应该正确初始化状态', () => {
    const sm = new TaskStateMachine();
    expect(sm.getStatus()).toBe('pending');
  });

  it('应该支持完整的状态流转', () => {
    const sm = new TaskStateMachine();

    expect(sm.start().success).toBe(true);
    expect(sm.getStatus()).toBe('in_progress');

    expect(sm.complete().success).toBe(true);
    expect(sm.getStatus()).toBe('completed');
  });

  it('应该支持失败流转', () => {
    const sm = new TaskStateMachine();

    expect(sm.start().success).toBe(true);
    expect(sm.fail().success).toBe(true);
    expect(sm.getStatus()).toBe('failed');

    expect(sm.retry().success).toBe(true);
    expect(sm.getStatus()).toBe('pending');
  });

  it('应该检查是否可以开始', () => {
    const sm1 = new TaskStateMachine('pending');
    expect(sm1.canStart()).toBe(true);

    const sm2 = new TaskStateMachine('in_progress');
    expect(sm2.canStart()).toBe(false);
  });

  it('应该检查是否正在执行', () => {
    const sm1 = new TaskStateMachine('in_progress');
    expect(sm1.isInProgress()).toBe(true);

    const sm2 = new TaskStateMachine('pending');
    expect(sm2.isInProgress()).toBe(false);
  });

  it('应该检查是否已完成', () => {
    const sm1 = new TaskStateMachine('completed');
    expect(sm1.isCompleted()).toBe(true);

    const sm2 = new TaskStateMachine('in_progress');
    expect(sm2.isCompleted()).toBe(false);
  });
});
