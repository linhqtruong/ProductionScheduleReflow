import { Scheduler, ReflowOptimizer, ScheduleUtils, Task, Resource } from './index';

/**
 * Example demonstrating the Production Schedule Reflow system
 */
function main() {
  console.log('=== Production Schedule Reflow Demo ===\n');

  // Define resources
  const resources: Resource[] = [
    { id: 'machine1', name: 'Machine 1', capacity: 1 },
    { id: 'machine2', name: 'Machine 2', capacity: 1 },
    { id: 'worker1', name: 'Worker 1', capacity: 1 }
  ];

  // Define tasks for a production line
  const tasks: Task[] = [
    {
      id: 'task1',
      name: 'Prepare materials',
      duration: 2,
      dependencies: [],
      resourceRequirements: ['worker1'],
      priority: 1
    },
    {
      id: 'task2',
      name: 'Machine setup',
      duration: 3,
      dependencies: [],
      resourceRequirements: ['machine1'],
      priority: 2
    },
    {
      id: 'task3',
      name: 'Production run A',
      duration: 5,
      dependencies: ['task1', 'task2'],
      resourceRequirements: ['machine1', 'worker1'],
      priority: 3
    },
    {
      id: 'task4',
      name: 'Production run B',
      duration: 4,
      dependencies: ['task1'],
      resourceRequirements: ['machine2'],
      priority: 2
    },
    {
      id: 'task5',
      name: 'Quality check A',
      duration: 2,
      dependencies: ['task3'],
      resourceRequirements: ['worker1'],
      priority: 1
    },
    {
      id: 'task6',
      name: 'Quality check B',
      duration: 2,
      dependencies: ['task4'],
      resourceRequirements: ['worker1'],
      priority: 1
    },
    {
      id: 'task7',
      name: 'Packaging',
      duration: 3,
      dependencies: ['task5', 'task6'],
      resourceRequirements: ['worker1'],
      priority: 3
    }
  ];

  // Create initial schedule
  const scheduler = new Scheduler(resources);
  const initialSchedule = scheduler.schedule(tasks);

  console.log('--- INITIAL SCHEDULE ---');
  ScheduleUtils.printSchedule(initialSchedule);

  // Validate the schedule
  const validation = ScheduleUtils.validateSchedule(initialSchedule);
  if (!validation.valid) {
    console.log('Validation errors:');
    validation.errors.forEach(error => console.log(`  - ${error}`));
  } else {
    console.log('✓ Initial schedule is valid\n');
  }

  // Apply reflow optimization
  const optimizer = new ReflowOptimizer();
  const reflowedSchedule = optimizer.reflow(initialSchedule);

  console.log('--- REFLOWED SCHEDULE ---');
  ScheduleUtils.printSchedule(reflowedSchedule);

  // Validate the reflowed schedule
  const reflowValidation = ScheduleUtils.validateSchedule(reflowedSchedule);
  if (!reflowValidation.valid) {
    console.log('Validation errors:');
    reflowValidation.errors.forEach(error => console.log(`  - ${error}`));
  } else {
    console.log('✓ Reflowed schedule is valid\n');
  }

  // Compare schedules
  const comparison = ScheduleUtils.compareSchedules(initialSchedule, reflowedSchedule);
  console.log('--- OPTIMIZATION RESULTS ---');
  console.log(`Duration improvement: ${comparison.durationImprovement} time units`);
  console.log(`Percentage improvement: ${comparison.percentImprovement.toFixed(2)}%\n`);

  // Calculate and show critical path
  const criticalPath = ScheduleUtils.calculateCriticalPath(reflowedSchedule);
  console.log('--- CRITICAL PATH ---');
  console.log('Tasks on critical path:');
  criticalPath.forEach(task => {
    console.log(`  ${task.name} (${task.startTime} - ${task.endTime})`);
  });
  console.log();

  // Try priority-based optimization
  const priorityOptimized = optimizer.optimizeByPriority(initialSchedule);
  console.log('--- PRIORITY-OPTIMIZED SCHEDULE ---');
  ScheduleUtils.printSchedule(priorityOptimized);

  const priorityComparison = ScheduleUtils.compareSchedules(initialSchedule, priorityOptimized);
  console.log('--- PRIORITY OPTIMIZATION RESULTS ---');
  console.log(`Duration improvement: ${priorityComparison.durationImprovement} time units`);
  console.log(`Percentage improvement: ${priorityComparison.percentImprovement.toFixed(2)}%\n`);
}

// Run the demo
main();
