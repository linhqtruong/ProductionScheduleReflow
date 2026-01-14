/**
 * Represents a task in the production schedule
 */
export interface Task {
  id: string;
  name: string;
  duration: number; // in time units (e.g., hours)
  dependencies: string[]; // IDs of tasks that must complete before this task
  resourceRequirements?: string[]; // Resources needed to complete the task
  priority?: number; // Higher numbers indicate higher priority
}

/**
 * Represents a resource available for production
 */
export interface Resource {
  id: string;
  name: string;
  capacity: number; // How many tasks this resource can handle simultaneously
}

/**
 * Represents a scheduled task with timing information
 */
export interface ScheduledTask extends Task {
  startTime: number;
  endTime: number;
  assignedResources: string[]; // IDs of resources assigned to this task
}

/**
 * Represents a complete production schedule
 */
export interface Schedule {
  tasks: ScheduledTask[];
  totalDuration: number;
  resources: Resource[];
}
