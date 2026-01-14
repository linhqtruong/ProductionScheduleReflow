import { ReflowOptimizer } from '../reflow';
import { Schedule, ScheduledTask, Resource } from '../types';

describe('ReflowOptimizer', () => {
  let optimizer: ReflowOptimizer;
  let resources: Resource[];

  beforeEach(() => {
    optimizer = new ReflowOptimizer();
    resources = [
      { id: 'machine1', name: 'Machine 1', capacity: 1 },
      { id: 'worker1', name: 'Worker 1', capacity: 1 }
    ];
  });

  test('should compact schedule with gaps', () => {
    const tasks: ScheduledTask[] = [
      {
        id: 'task1',
        name: 'Task 1',
        duration: 2,
        dependencies: [],
        startTime: 0,
        endTime: 2,
        assignedResources: []
      },
      {
        id: 'task2',
        name: 'Task 2',
        duration: 3,
        dependencies: [],
        startTime: 5, // Gap here
        endTime: 8,
        assignedResources: []
      }
    ];

    const schedule: Schedule = {
      tasks,
      totalDuration: 8,
      resources
    };

    const optimized = optimizer.reflow(schedule);

    const task2 = optimized.tasks.find(t => t.id === 'task2');
    expect(task2?.startTime).toBe(0); // Should move to start since no dependencies
  });

  test('should respect dependencies during reflow', () => {
    const tasks: ScheduledTask[] = [
      {
        id: 'task1',
        name: 'Task 1',
        duration: 5,
        dependencies: [],
        startTime: 0,
        endTime: 5,
        assignedResources: []
      },
      {
        id: 'task2',
        name: 'Task 2',
        duration: 3,
        dependencies: ['task1'],
        startTime: 10, // Delayed start
        endTime: 13,
        assignedResources: []
      }
    ];

    const schedule: Schedule = {
      tasks,
      totalDuration: 13,
      resources
    };

    const optimized = optimizer.reflow(schedule);

    const task2 = optimized.tasks.find(t => t.id === 'task2');
    expect(task2?.startTime).toBe(5); // Should start right after task1
    expect(optimized.totalDuration).toBe(8);
  });

  test('should handle resource conflicts', () => {
    const tasks: ScheduledTask[] = [
      {
        id: 'task1',
        name: 'Task 1',
        duration: 3,
        dependencies: [],
        startTime: 0,
        endTime: 3,
        assignedResources: ['worker1']
      },
      {
        id: 'task2',
        name: 'Task 2',
        duration: 2,
        dependencies: [],
        startTime: 5,
        endTime: 7,
        assignedResources: ['worker1']
      }
    ];

    const schedule: Schedule = {
      tasks,
      totalDuration: 7,
      resources
    };

    const optimized = optimizer.reflow(schedule);

    const task2 = optimized.tasks.find(t => t.id === 'task2');
    expect(task2?.startTime).toBeGreaterThanOrEqual(3); // Can't overlap with task1
  });

  test('should optimize by priority', () => {
    const tasks: ScheduledTask[] = [
      {
        id: 'task1',
        name: 'Task 1',
        duration: 2,
        dependencies: [],
        priority: 1,
        startTime: 0,
        endTime: 2,
        assignedResources: []
      },
      {
        id: 'task2',
        name: 'Task 2',
        duration: 2,
        dependencies: [],
        priority: 3,
        startTime: 2,
        endTime: 4,
        assignedResources: []
      }
    ];

    const schedule: Schedule = {
      tasks,
      totalDuration: 4,
      resources
    };

    const optimized = optimizer.optimizeByPriority(schedule);

    // Higher priority task should be considered first
    const task2 = optimized.tasks.find(t => t.id === 'task2');
    expect(task2).toBeDefined();
    expect(optimized.tasks).toHaveLength(2);
  });
});
