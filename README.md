# ProductionScheduleReflow

A TypeScript library for creating and optimizing production schedules through reflow algorithms.

## Overview

ProductionScheduleReflow provides tools to:
- Create production schedules from tasks with dependencies
- Optimize schedules using reflow algorithms
- Handle resource constraints and conflicts
- Calculate critical paths
- Validate schedule integrity

## Installation

```bash
npm install
```

## Building

```bash
npm run build
```

## Usage

### Basic Example

```typescript
import { Scheduler, ReflowOptimizer, ScheduleUtils, Task, Resource } from 'productionschedulereflow';

// Define resources
const resources: Resource[] = [
  { id: 'machine1', name: 'Machine 1', capacity: 1 },
  { id: 'worker1', name: 'Worker 1', capacity: 1 }
];

// Define tasks
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
    name: 'Production',
    duration: 5,
    dependencies: ['task1'],
    resourceRequirements: ['machine1', 'worker1'],
    priority: 2
  }
];

// Create schedule
const scheduler = new Scheduler(resources);
const schedule = scheduler.schedule(tasks);

// Optimize with reflow
const optimizer = new ReflowOptimizer();
const optimized = optimizer.reflow(schedule);

// Print results
ScheduleUtils.printSchedule(optimized);
```

### Running the Demo

```bash
npm run demo
```

This will run a comprehensive example showing:
- Initial schedule creation
- Schedule validation
- Reflow optimization
- Priority-based optimization
- Critical path calculation
- Performance comparison

## Features

### Scheduler
- Dependency-aware task scheduling
- Priority-based task ordering
- Topological sorting for dependency resolution
- Resource assignment

### ReflowOptimizer
- Schedule compaction to minimize total duration
- Resource conflict resolution
- Priority-based optimization
- Maintains dependency constraints

### ScheduleUtils
- Schedule validation
- Critical path calculation
- Schedule comparison metrics
- Readable schedule output

## API

### Types

#### Task
```typescript
interface Task {
  id: string;
  name: string;
  duration: number;
  dependencies: string[];
  resourceRequirements?: string[];
  priority?: number;
}
```

#### Resource
```typescript
interface Resource {
  id: string;
  name: string;
  capacity: number;
}
```

#### Schedule
```typescript
interface Schedule {
  tasks: ScheduledTask[];
  totalDuration: number;
  resources: Resource[];
}
```

## License

ISC

