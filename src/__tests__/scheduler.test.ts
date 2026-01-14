import { Scheduler } from '../scheduler';
import { Task, Resource } from '../types';

describe('Scheduler', () => {
  let scheduler: Scheduler;
  let resources: Resource[];

  beforeEach(() => {
    resources = [
      { id: 'machine1', name: 'Machine 1', capacity: 1 },
      { id: 'worker1', name: 'Worker 1', capacity: 1 }
    ];
    scheduler = new Scheduler(resources);
  });

  test('should schedule tasks without dependencies', () => {
    const tasks: Task[] = [
      { id: 'task1', name: 'Task 1', duration: 5, dependencies: [] },
      { id: 'task2', name: 'Task 2', duration: 3, dependencies: [] }
    ];

    const schedule = scheduler.schedule(tasks);

    expect(schedule.tasks).toHaveLength(2);
    expect(schedule.tasks[0].startTime).toBe(0);
    expect(schedule.tasks[1].startTime).toBe(0);
  });

  test('should schedule tasks with dependencies', () => {
    const tasks: Task[] = [
      { id: 'task1', name: 'Task 1', duration: 5, dependencies: [] },
      { id: 'task2', name: 'Task 2', duration: 3, dependencies: ['task1'] }
    ];

    const schedule = scheduler.schedule(tasks);

    expect(schedule.tasks).toHaveLength(2);
    const task1 = schedule.tasks.find(t => t.id === 'task1');
    const task2 = schedule.tasks.find(t => t.id === 'task2');

    expect(task1?.startTime).toBe(0);
    expect(task1?.endTime).toBe(5);
    expect(task2?.startTime).toBe(5);
    expect(task2?.endTime).toBe(8);
  });

  test('should handle multiple dependencies', () => {
    const tasks: Task[] = [
      { id: 'task1', name: 'Task 1', duration: 3, dependencies: [] },
      { id: 'task2', name: 'Task 2', duration: 2, dependencies: [] },
      { id: 'task3', name: 'Task 3', duration: 4, dependencies: ['task1', 'task2'] }
    ];

    const schedule = scheduler.schedule(tasks);

    const task3 = schedule.tasks.find(t => t.id === 'task3');
    expect(task3?.startTime).toBe(3); // Starts after the longest dependency
  });

  test('should respect priority ordering', () => {
    const tasks: Task[] = [
      { id: 'task1', name: 'Task 1', duration: 2, dependencies: [], priority: 1 },
      { id: 'task2', name: 'Task 2', duration: 2, dependencies: [], priority: 3 },
      { id: 'task3', name: 'Task 3', duration: 2, dependencies: [], priority: 2 }
    ];

    const schedule = scheduler.schedule(tasks);

    // Higher priority tasks should be scheduled first (when no dependencies)
    expect(schedule.tasks[0].id).toBe('task2'); // priority 3
  });

  test('should detect circular dependencies', () => {
    const tasks: Task[] = [
      { id: 'task1', name: 'Task 1', duration: 2, dependencies: ['task2'] },
      { id: 'task2', name: 'Task 2', duration: 2, dependencies: ['task1'] }
    ];

    expect(() => scheduler.schedule(tasks)).toThrow('Circular dependency');
  });

  test('should calculate total duration correctly', () => {
    const tasks: Task[] = [
      { id: 'task1', name: 'Task 1', duration: 5, dependencies: [] },
      { id: 'task2', name: 'Task 2', duration: 3, dependencies: ['task1'] }
    ];

    const schedule = scheduler.schedule(tasks);

    expect(schedule.totalDuration).toBe(8);
  });
});
