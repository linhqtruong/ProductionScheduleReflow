import { Task, Resource, ScheduledTask, Schedule } from './types';

/**
 * Scheduler class that creates production schedules
 */
export class Scheduler {
  private resources: Resource[];

  constructor(resources: Resource[]) {
    this.resources = resources;
  }

  /**
   * Creates a schedule from a list of tasks using a basic dependency-aware algorithm
   */
  schedule(tasks: Task[]): Schedule {
    const scheduledTasks: ScheduledTask[] = [];
    const taskMap = new Map<string, Task>();
    const completionTimes = new Map<string, number>();

    // Build task map
    tasks.forEach(task => taskMap.set(task.id, task));

    // Sort tasks by priority (higher first) and then by dependencies
    const sortedTasks = this.topologicalSort(tasks);

    // Schedule each task
    for (const task of sortedTasks) {
      const earliestStart = this.calculateEarliestStart(task, completionTimes);
      const startTime = earliestStart;
      const endTime = startTime + task.duration;

      const scheduledTask: ScheduledTask = {
        ...task,
        startTime,
        endTime,
        assignedResources: task.resourceRequirements || []
      };

      scheduledTasks.push(scheduledTask);
      completionTimes.set(task.id, endTime);
    }

    const totalDuration = Math.max(...scheduledTasks.map(t => t.endTime), 0);

    return {
      tasks: scheduledTasks,
      totalDuration,
      resources: this.resources
    };
  }

  /**
   * Calculates the earliest start time for a task based on its dependencies
   */
  private calculateEarliestStart(task: Task, completionTimes: Map<string, number>): number {
    if (!task.dependencies || task.dependencies.length === 0) {
      return 0;
    }

    let maxDependencyEnd = 0;
    for (const depId of task.dependencies) {
      const depEndTime = completionTimes.get(depId) || 0;
      maxDependencyEnd = Math.max(maxDependencyEnd, depEndTime);
    }

    return maxDependencyEnd;
  }

  /**
   * Performs topological sort on tasks to respect dependencies
   */
  private topologicalSort(tasks: Task[]): Task[] {
    const sorted: Task[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();
    const taskMap = new Map<string, Task>();

    tasks.forEach(task => taskMap.set(task.id, task));

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      if (temp.has(taskId)) {
        throw new Error(`Circular dependency detected involving task ${taskId}`);
      }

      temp.add(taskId);

      const task = taskMap.get(taskId);
      if (task && task.dependencies) {
        for (const depId of task.dependencies) {
          visit(depId);
        }
      }

      temp.delete(taskId);
      visited.add(taskId);
      if (task) {
        sorted.push(task);
      }
    };

    // Sort by priority first (descending)
    const prioritySorted = [...tasks].sort((a, b) => 
      (b.priority || 0) - (a.priority || 0)
    );

    for (const task of prioritySorted) {
      if (!visited.has(task.id)) {
        visit(task.id);
      }
    }

    return sorted;
  }
}
