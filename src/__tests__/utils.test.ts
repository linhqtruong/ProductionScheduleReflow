import { ScheduleUtils } from '../utils';
import { Schedule, ScheduledTask, Resource } from '../types';

describe('ScheduleUtils', () => {
  let resources: Resource[];

  beforeEach(() => {
    resources = [
      { id: 'machine1', name: 'Machine 1', capacity: 1 }
    ];
  });

  describe('validateSchedule', () => {
    test('should validate correct schedule', () => {
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
          startTime: 5,
          endTime: 8,
          assignedResources: []
        }
      ];

      const schedule: Schedule = {
        tasks,
        totalDuration: 8,
        resources
      };

      const validation = ScheduleUtils.validateSchedule(schedule);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect dependency violations', () => {
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
          startTime: 3, // Starts before task1 ends
          endTime: 6,
          assignedResources: []
        }
      ];

      const schedule: Schedule = {
        tasks,
        totalDuration: 6,
        resources
      };

      const validation = ScheduleUtils.validateSchedule(schedule);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('before dependency');
    });

    test('should detect timing inconsistencies', () => {
      const tasks: ScheduledTask[] = [
        {
          id: 'task1',
          name: 'Task 1',
          duration: 5,
          dependencies: [],
          startTime: 0,
          endTime: 6, // Should be 5
          assignedResources: []
        }
      ];

      const schedule: Schedule = {
        tasks,
        totalDuration: 6,
        resources
      };

      const validation = ScheduleUtils.validateSchedule(schedule);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('inconsistent timing');
    });

    test('should detect non-existent dependencies', () => {
      const tasks: ScheduledTask[] = [
        {
          id: 'task1',
          name: 'Task 1',
          duration: 5,
          dependencies: ['nonexistent'],
          startTime: 0,
          endTime: 5,
          assignedResources: []
        }
      ];

      const schedule: Schedule = {
        tasks,
        totalDuration: 5,
        resources
      };

      const validation = ScheduleUtils.validateSchedule(schedule);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('non-existent');
    });
  });

  describe('calculateCriticalPath', () => {
    test('should identify critical path', () => {
      const tasks: ScheduledTask[] = [
        {
          id: 'task1',
          name: 'Task 1',
          duration: 3,
          dependencies: [],
          startTime: 0,
          endTime: 3,
          assignedResources: []
        },
        {
          id: 'task2',
          name: 'Task 2',
          duration: 2,
          dependencies: [],
          startTime: 0,
          endTime: 2,
          assignedResources: []
        },
        {
          id: 'task3',
          name: 'Task 3',
          duration: 4,
          dependencies: ['task1'],
          startTime: 3,
          endTime: 7,
          assignedResources: []
        }
      ];

      const schedule: Schedule = {
        tasks,
        totalDuration: 7,
        resources
      };

      const criticalPath = ScheduleUtils.calculateCriticalPath(schedule);
      
      expect(criticalPath).toHaveLength(2);
      expect(criticalPath[0].id).toBe('task1');
      expect(criticalPath[1].id).toBe('task3');
    });
  });

  describe('compareSchedules', () => {
    test('should compare two schedules', () => {
      const original: Schedule = {
        tasks: [],
        totalDuration: 10,
        resources
      };

      const optimized: Schedule = {
        tasks: [],
        totalDuration: 8,
        resources
      };

      const comparison = ScheduleUtils.compareSchedules(original, optimized);
      
      expect(comparison.durationImprovement).toBe(2);
      expect(comparison.percentImprovement).toBe(20);
    });

    test('should handle worse schedules', () => {
      const original: Schedule = {
        tasks: [],
        totalDuration: 10,
        resources
      };

      const worse: Schedule = {
        tasks: [],
        totalDuration: 12,
        resources
      };

      const comparison = ScheduleUtils.compareSchedules(original, worse);
      
      expect(comparison.durationImprovement).toBe(-2);
      expect(comparison.percentImprovement).toBe(-20);
    });
  });
});
