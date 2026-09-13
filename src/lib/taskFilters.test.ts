import { describe, it, expect } from 'vitest';
import { matchesTaskFilters, EMPTY_TASK_FILTERS, type FilterableTask, type TaskFilters } from './taskFilters';

describe('taskFilters - matchesTaskFilters', () => {
  const baseTask: FilterableTask = {
    title: 'Complete paperwork',
    description: 'Fill out W-4 form',
    status: 'TODO',
    priority: 'HIGH',
    assigneeIds: ['user-1'],
    dueDate: null,
    projectId: 'proj-1',
    tags: [],
  };

  const onboardingTaskWithoutPriority: FilterableTask = {
    title: 'Onboarding paperwork',
    description: null,
    status: 'TODO',
    assigneeIds: ['user-1'],
    dueDate: null,
    tags: [],
  };

  it('matches when default or empty filters are used', () => {
    expect(matchesTaskFilters(baseTask, EMPTY_TASK_FILTERS)).toBe(true);
    expect(matchesTaskFilters(onboardingTaskWithoutPriority, EMPTY_TASK_FILTERS)).toBe(true);
  });

  it('matches status filters for both standard and onboarding tasks', () => {
    const filters: TaskFilters = { ...EMPTY_TASK_FILTERS, statuses: ['TODO', 'IN_PROGRESS'] };
    expect(matchesTaskFilters(baseTask, filters)).toBe(true);
    expect(matchesTaskFilters(onboardingTaskWithoutPriority, filters)).toBe(true);

    const doneFilters: TaskFilters = { ...EMPTY_TASK_FILTERS, statuses: ['DONE'] };
    expect(matchesTaskFilters(onboardingTaskWithoutPriority, doneFilters)).toBe(false);
  });

  it('handles priority filtering when task has no priority', () => {
    const priorityFilters: TaskFilters = { ...EMPTY_TASK_FILTERS, priorities: ['HIGH', 'URGENT'] };
    expect(matchesTaskFilters(baseTask, priorityFilters)).toBe(true);
    // Task without priority should not match specific priority filters
    expect(matchesTaskFilters(onboardingTaskWithoutPriority, priorityFilters)).toBe(false);
  });

  it('handles project filtering when task has no projectId', () => {
    const projectFilters: TaskFilters = { ...EMPTY_TASK_FILTERS, projectIds: ['proj-1'] };
    expect(matchesTaskFilters(baseTask, projectFilters)).toBe(true);
    expect(matchesTaskFilters(onboardingTaskWithoutPriority, projectFilters)).toBe(false);
  });

  it('matches search query on title', () => {
    const searchFilters: TaskFilters = { ...EMPTY_TASK_FILTERS, search: 'paperwork' };
    expect(matchesTaskFilters(baseTask, searchFilters)).toBe(true);
    expect(matchesTaskFilters(onboardingTaskWithoutPriority, searchFilters)).toBe(true);
  });
});
