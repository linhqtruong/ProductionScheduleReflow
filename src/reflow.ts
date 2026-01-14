import { Schedule, ScheduledTask } from './types';

/**
 * Reflow optimizer that optimizes production schedules
 */
export class ReflowOptimizer {
  /**
   * Optimizes a schedule by reflowing tasks to minimize total duration
   * while respecting dependencies
   */
  reflow(schedule: Schedule): Schedule {
    const tasks = [...schedule.tasks];
    
    // Sort tasks by start time
    tasks.sort((a, b) => a.startTime - b.startTime);

    // Try to compact the schedule by moving tasks earlier when possible
    const optimizedTasks = this.compactSchedule(tasks);

    // Calculate new total duration
    const totalDuration = Math.max(...optimizedTasks.map(t => t.endTime), 0);

    return {
      tasks: optimizedTasks,
      totalDuration,
      resources: schedule.resources
    };
  }

  /**
   * Compacts the schedule by moving tasks as early as possible
   */
  private compactSchedule(tasks: ScheduledTask[]): ScheduledTask[] {
    const optimized: ScheduledTask[] = [];
    const completionTimes = new Map<string, number>();

    for (const task of tasks) {
      // Calculate earliest possible start based on dependencies
      let earliestStart = 0;
      
      if (task.dependencies && task.dependencies.length > 0) {
        for (const depId of task.dependencies) {
          const depEndTime = completionTimes.get(depId);
          if (depEndTime !== undefined) {
            earliestStart = Math.max(earliestStart, depEndTime);
          }
        }
      }

      // Check for resource conflicts and adjust start time if needed
      earliestStart = this.findNextAvailableSlot(
        optimized,
        earliestStart,
        task.duration,
        task.assignedResources
      );

      const optimizedTask: ScheduledTask = {
        ...task,
        startTime: earliestStart,
        endTime: earliestStart + task.duration
      };

      optimized.push(optimizedTask);
      completionTimes.set(task.id, optimizedTask.endTime);
    }

    return optimized;
  }

  /**
   * Finds the next available time slot for a task considering resource conflicts
   */
  private findNextAvailableSlot(
    scheduledTasks: ScheduledTask[],
    earliestStart: number,
    duration: number,
    resources: string[]
  ): number {
    if (resources.length === 0) {
      return earliestStart;
    }

    let currentStart = earliestStart;
    let hasConflict = true;

    while (hasConflict) {
      hasConflict = false;
      const proposedEnd = currentStart + duration;

      // Check for conflicts with already scheduled tasks
      for (const scheduled of scheduledTasks) {
        const hasSharedResource = resources.some(r => 
          scheduled.assignedResources.includes(r)
        );

        if (hasSharedResource) {
          // Check if time ranges overlap
          const overlaps = 
            currentStart < scheduled.endTime && 
            proposedEnd > scheduled.startTime;

          if (overlaps) {
            // Move to after this conflicting task
            currentStart = scheduled.endTime;
            hasConflict = true;
            break;
          }
        }
      }
    }

    return currentStart;
  }

  /**
   * Optimizes schedule by prioritizing high-priority tasks
   */
  optimizeByPriority(schedule: Schedule): Schedule {
    const tasks = [...schedule.tasks];
    
    // Sort by priority (descending) then by dependencies
    const prioritySorted = tasks.sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return a.startTime - b.startTime;
    });

    // Reflow the priority-sorted schedule
    return this.reflow({
      tasks: prioritySorted,
      totalDuration: schedule.totalDuration,
      resources: schedule.resources
    });
  }
}
