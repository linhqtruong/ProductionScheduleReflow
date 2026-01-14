import { Schedule, ScheduledTask } from './types';

/**
 * Utility functions for working with schedules
 */
export class ScheduleUtils {
  /**
   * Prints a schedule in a readable format
   */
  static printSchedule(schedule: Schedule): void {
    console.log('\n=== Production Schedule ===');
    console.log(`Total Duration: ${schedule.totalDuration} time units\n`);

    const sortedTasks = [...schedule.tasks].sort((a, b) => a.startTime - b.startTime);

    sortedTasks.forEach(task => {
      console.log(`Task: ${task.name} (${task.id})`);
      console.log(`  Time: ${task.startTime} - ${task.endTime} (Duration: ${task.duration})`);
      if (task.dependencies.length > 0) {
        console.log(`  Dependencies: ${task.dependencies.join(', ')}`);
      }
      if (task.assignedResources.length > 0) {
        console.log(`  Resources: ${task.assignedResources.join(', ')}`);
      }
      if (task.priority !== undefined) {
        console.log(`  Priority: ${task.priority}`);
      }
      console.log();
    });
  }

  /**
   * Validates that a schedule respects all dependencies
   */
  static validateSchedule(schedule: Schedule): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const taskMap = new Map<string, ScheduledTask>();

    schedule.tasks.forEach(task => taskMap.set(task.id, task));

    for (const task of schedule.tasks) {
      // Check dependencies
      if (task.dependencies) {
        for (const depId of task.dependencies) {
          const dependency = taskMap.get(depId);
          if (!dependency) {
            errors.push(`Task ${task.id} depends on non-existent task ${depId}`);
          } else if (dependency.endTime > task.startTime) {
            errors.push(
              `Task ${task.id} starts at ${task.startTime} before dependency ${depId} ends at ${dependency.endTime}`
            );
          }
        }
      }

      // Check timing consistency
      if (task.endTime !== task.startTime + task.duration) {
        errors.push(
          `Task ${task.id} has inconsistent timing: end(${task.endTime}) != start(${task.startTime}) + duration(${task.duration})`
        );
      }

      if (task.startTime < 0) {
        errors.push(`Task ${task.id} has negative start time: ${task.startTime}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculates the critical path of the schedule
   */
  static calculateCriticalPath(schedule: Schedule): ScheduledTask[] {
    const taskMap = new Map<string, ScheduledTask>();
    schedule.tasks.forEach(task => taskMap.set(task.id, task));

    // Find the task that ends last
    const lastTask = schedule.tasks.reduce((latest, task) => 
      task.endTime > latest.endTime ? task : latest
    );

    // Trace back through dependencies
    const criticalPath: ScheduledTask[] = [];
    const visited = new Set<string>();

    const tracePath = (task: ScheduledTask) => {
      if (visited.has(task.id)) return;
      visited.add(task.id);
      criticalPath.unshift(task);

      if (task.dependencies && task.dependencies.length > 0) {
        // Find the dependency that determines this task's start time
        let criticalDep: ScheduledTask | null = null;
        for (const depId of task.dependencies) {
          const dep = taskMap.get(depId);
          if (dep && dep.endTime === task.startTime) {
            criticalDep = dep;
            break;
          }
        }
        // If no exact match, find the latest ending dependency
        if (!criticalDep) {
          let latestEnd = -1;
          for (const depId of task.dependencies) {
            const dep = taskMap.get(depId);
            if (dep && dep.endTime > latestEnd) {
              latestEnd = dep.endTime;
              criticalDep = dep;
            }
          }
        }
        if (criticalDep) {
          tracePath(criticalDep);
        }
      }
    };

    tracePath(lastTask);

    return criticalPath;
  }

  /**
   * Compares two schedules and returns improvement metrics
   */
  static compareSchedules(
    original: Schedule,
    optimized: Schedule
  ): { durationImprovement: number; percentImprovement: number } {
    const durationImprovement = original.totalDuration - optimized.totalDuration;
    const percentImprovement = 
      original.totalDuration > 0 
        ? (durationImprovement / original.totalDuration) * 100 
        : 0;

    return {
      durationImprovement,
      percentImprovement
    };
  }
}
