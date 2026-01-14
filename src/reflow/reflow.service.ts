/**
 * Production Schedule Reflow Service
 * 
 * Main algorithm for rescheduling work orders while respecting constraints:
 * - Dependencies (all parents must complete before child)
 * - Work center conflicts (no overlaps)
 * - Shift boundaries (work pauses outside shifts)
 * - Maintenance windows (blocked time)
 */

import { ReflowInput, ReflowResult, WorkOrder, Change, OptimizationMetrics } from "./types";
import { 
  parseDate, 
  formatDate, 
  isWithinShift, 
  isInMaintenanceWindow,
  getNextShiftStart,
  getMinutesUntilShiftEnd,
  getMinutesUntilMaintenanceWindow,
  getNextAvailableTime,
  calculateAvailableWorkTime
} from "../utils/date-utils";
import { DAG } from "./dag";
import { DateTime } from "luxon";

export class ReflowService {
  /**
   * Main reflow algorithm
   */
  reflow(input: ReflowInput): ReflowResult {
    // @upgrade: Add validation for input data
    
    // Separate maintenance orders (cannot be rescheduled)
    const maintenanceOrders = input.workOrders.filter((wo) => wo.data.isMaintenance);
    const reschedulableOrders = input.workOrders.filter((wo) => !wo.data.isMaintenance);
    
    // Build DAG and perform topological sort
    const dag = new DAG();
    dag.build(reschedulableOrders);
    
    // Check for cycles
    if (dag.hasCycles()) {
      const cycles = dag.detectCycles();
      const cycleInfo = cycles.map(cycle => 
        cycle.map(id => {
          const wo = reschedulableOrders.find(w => w.docId === id);
          return wo ? wo.data.workOrderNumber : id;
        }).join(' → ')
      ).join('; ');
      throw new Error(`Circular dependency detected: ${cycleInfo}`);
    }
    
    // Perform topological sort using DAG
    const sortedOrders = dag.topologicalSort();
    
    // Create a map for quick lookup
    const workCenterMap = new Map(
      input.workCenters.map((wc) => [wc.docId, wc])
    );
    
    // Track scheduled orders per work center
    const scheduleByWorkCenter = new Map<string, WorkOrder[]>();
    
    // Process orders in dependency order
    const updatedOrders: WorkOrder[] = [...maintenanceOrders];
    const changes: Change[] = [];
    
    for (const workOrder of sortedOrders) {
      const workCenter = workCenterMap.get(workOrder.data.workCenterId);
      if (!workCenter) {
        throw new Error(`Work center not found: ${workOrder.data.workCenterId}`);
      }
      
      // Calculate earliest start time based on dependencies
      const { startTime: earliestStart, blockingDependencies } = this.calculateEarliestStartTime(
        workOrder,
        updatedOrders,
        input.workOrders
      );
      
      // Calculate actual start time considering work center conflicts
      const { startTime: actualStart, blockingWorkOrder } = this.calculateActualStartTime(
        workOrder,
        earliestStart,
        workCenter,
        scheduleByWorkCenter
      );
      
      // Calculate end time considering shifts and maintenance windows
      // Include setup time if specified
      const totalWorkMinutes = workOrder.data.durationMinutes + (workOrder.data.setupTimeMinutes || 0);
      
      // Validate that the work order can be scheduled
      // Check if there's enough available time within a reasonable window
      this.validateSchedulability(
        workOrder,
        actualStart,
        totalWorkMinutes,
        workCenter
      );
      
      const actualEnd = this.calculateEndTime(
        actualStart,
        totalWorkMinutes,
        workCenter
      );
      
      // Create updated work order
      const updatedOrder: WorkOrder = {
        ...workOrder,
        data: {
          ...workOrder.data,
          startDate: formatDate(actualStart),
          endDate: formatDate(actualEnd),
        },
      };
      
      updatedOrders.push(updatedOrder);
      
      // Track schedule per work center
      if (!scheduleByWorkCenter.has(workOrder.data.workCenterId)) {
        scheduleByWorkCenter.set(workOrder.data.workCenterId, []);
      }
      scheduleByWorkCenter.get(workOrder.data.workCenterId)!.push(updatedOrder);
      
      // Record changes
      const originalStart = parseDate(workOrder.data.startDate);
      const originalEnd = parseDate(workOrder.data.endDate);
      
      if (!actualStart.equals(originalStart) || !actualEnd.equals(originalEnd)) {
        changes.push({
          workOrderId: workOrder.docId,
          workOrderNumber: workOrder.data.workOrderNumber,
          oldStartDate: workOrder.data.startDate,
          newStartDate: formatDate(actualStart),
          oldEndDate: workOrder.data.endDate,
          newEndDate: formatDate(actualEnd),
          reason: this.generateChangeReason(
            workOrder,
            actualStart,
            originalStart,
            actualEnd,
            originalEnd,
            blockingDependencies,
            blockingWorkOrder,
            workCenter
          ),
        });
      }
    }
    
    // Sort all orders by start date for output
    updatedOrders.sort((a, b) => 
      parseDate(a.data.startDate).toMillis() - parseDate(b.data.startDate).toMillis()
    );
    
    // Get DAG information
    const dagInfo = {
      hasCycles: dag.hasCycles(),
      cycles: dag.detectCycles(),
      rootNodes: dag.getRootNodes().map(n => n.workOrder.data.workOrderNumber),
      leafNodes: dag.getLeafNodes().map(n => n.workOrder.data.workOrderNumber),
    };

    // Calculate optimization metrics
    const metrics = this.calculateOptimizationMetrics(
      input.workOrders,
      updatedOrders,
      changes,
      input.workCenters
    );

    return {
      updatedWorkOrders: updatedOrders,
      changes,
      explanation: this.generateExplanation(changes),
      dagInfo,
      metrics,
    };
  }
  
  /**
   * Calculate optimization metrics
   * - Total delay introduced: Σ (new_end_date - original_end_date)
   * - Number of affected work orders
   * - Utilization metrics per work center: (total working minutes) / (total available shift minutes)
   * - Work center idle time analysis
   */
  private calculateOptimizationMetrics(
    originalWorkOrders: WorkOrder[],
    updatedWorkOrders: WorkOrder[],
    changes: Change[],
    workCenters: import("./types").WorkCenter[]
  ): OptimizationMetrics {
    // 1. Calculate total delay: Σ (new_end_date - original_end_date)
    let totalDelayMinutes = 0;
    const originalOrderMap = new Map(originalWorkOrders.map(wo => [wo.docId, wo]));
    
    for (const change of changes) {
      const originalOrder = originalOrderMap.get(change.workOrderId);
      if (originalOrder) {
        const originalEnd = parseDate(originalOrder.data.endDate);
        const newEnd = parseDate(change.newEndDate);
        const delayMinutes = newEnd.diff(originalEnd, 'minutes').minutes;
        totalDelayMinutes += delayMinutes;
      }
    }

    // 2. Affected work orders count
    const affectedWorkOrders = changes.length;
    const totalWorkOrders = updatedWorkOrders.length;

    // 3. Utilization metrics per work center
    const utilizationByWorkCenter = new Map<string, {
      totalWorkingMinutes: number;
      totalAvailableMinutes: number;
      utilizationPercent: number;
      idleTimeMinutes: number;
    }>();

    // Group work orders by work center
    const workOrdersByWorkCenter = new Map<string, WorkOrder[]>();
    for (const workOrder of updatedWorkOrders) {
      const wcId = workOrder.data.workCenterId;
      if (!workOrdersByWorkCenter.has(wcId)) {
        workOrdersByWorkCenter.set(wcId, []);
      }
      workOrdersByWorkCenter.get(wcId)!.push(workOrder);
    }

    // Calculate metrics for each work center
    for (const workCenter of workCenters) {
      const wcOrders = workOrdersByWorkCenter.get(workCenter.docId) || [];
      
      if (wcOrders.length === 0) {
        utilizationByWorkCenter.set(workCenter.docId, {
          totalWorkingMinutes: 0,
          totalAvailableMinutes: 0,
          utilizationPercent: 0,
          idleTimeMinutes: 0,
        });
        continue;
      }

      // Calculate total working minutes (including setup time)
      let totalWorkingMinutes = 0;
      for (const order of wcOrders) {
        const workMinutes = order.data.durationMinutes + (order.data.setupTimeMinutes || 0);
        totalWorkingMinutes += workMinutes;
      }

      // Find earliest start and latest end across all orders on this work center
      let earliestStart: DateTime | null = null;
      let latestEnd: DateTime | null = null;
      
      for (const order of wcOrders) {
        const start = parseDate(order.data.startDate);
        const end = parseDate(order.data.endDate);
        
        if (earliestStart === null || start < earliestStart) {
          earliestStart = start;
        }
        if (latestEnd === null || end > latestEnd) {
          latestEnd = end;
        }
      }

      // Calculate total available minutes (accounting for shifts and maintenance)
      let totalAvailableMinutes = 0;
      if (earliestStart && latestEnd) {
        totalAvailableMinutes = calculateAvailableWorkTime(
          earliestStart,
          latestEnd,
          workCenter.data.shifts,
          workCenter.data.maintenanceWindows
        );
      }

      // Calculate utilization and idle time
      const utilizationPercent = totalAvailableMinutes > 0
        ? (totalWorkingMinutes / totalAvailableMinutes) * 100
        : 0;
      const idleTimeMinutes = Math.max(0, totalAvailableMinutes - totalWorkingMinutes);

      utilizationByWorkCenter.set(workCenter.docId, {
        totalWorkingMinutes,
        totalAvailableMinutes,
        utilizationPercent: Math.round(utilizationPercent * 100) / 100, // Round to 2 decimal places
        idleTimeMinutes: Math.round(idleTimeMinutes),
      });
    }

    // 4. Calculate overall utilization (average across all work centers)
    let totalUtilizationSum = 0;
    let workCenterCount = 0;
    let totalIdleTimeMinutes = 0;

    for (const metrics of utilizationByWorkCenter.values()) {
      totalUtilizationSum += metrics.utilizationPercent;
      totalIdleTimeMinutes += metrics.idleTimeMinutes;
      workCenterCount++;
    }

    const overallUtilizationPercent = workCenterCount > 0
      ? Math.round((totalUtilizationSum / workCenterCount) * 100) / 100
      : 0;

    return {
      totalDelayMinutes: Math.round(totalDelayMinutes),
      totalDelayHours: Math.round(totalDelayMinutes / 60 * 100) / 100,
      affectedWorkOrders,
      totalWorkOrders,
      utilizationByWorkCenter,
      overallUtilizationPercent,
      totalIdleTimeMinutes: Math.round(totalIdleTimeMinutes),
    };
  }
  
  /**
   * Topological sort to handle dependencies
   * @deprecated Use DAG.topologicalSort() instead
   * Kept for backward compatibility
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private topologicalSort(workOrders: WorkOrder[]): WorkOrder[] {
    // This method is now replaced by DAG implementation
    // Keeping for reference but should use DAG class
    const dag = new DAG();
    dag.build(workOrders);
    return dag.topologicalSort();
  }
  
  /**
   * Calculate earliest start time based on dependencies
   */
  private calculateEarliestStartTime(
    workOrder: WorkOrder,
    updatedOrders: WorkOrder[],
    allOrders: WorkOrder[]
  ): { startTime: DateTime; blockingDependencies: string[] } {
    if (workOrder.data.dependsOnWorkOrderIds.length === 0) {
      return { startTime: parseDate(workOrder.data.startDate), blockingDependencies: [] };
    }
    
    // Find the latest end date of all dependencies
    let latestDependencyEnd = parseDate(workOrder.data.startDate);
    const blockingDeps: string[] = [];
    
    for (const depId of workOrder.data.dependsOnWorkOrderIds) {
      const depOrder = updatedOrders.find((wo) => wo.docId === depId) ||
                      allOrders.find((wo) => wo.docId === depId);
      
      if (depOrder) {
        const depEnd = parseDate(depOrder.data.endDate);
        if (depEnd > latestDependencyEnd) {
          latestDependencyEnd = depEnd;
          blockingDeps.push(depOrder.data.workOrderNumber);
        } else if (depEnd.equals(latestDependencyEnd)) {
          blockingDeps.push(depOrder.data.workOrderNumber);
        }
      }
    }
    
    return { startTime: latestDependencyEnd, blockingDependencies: blockingDeps };
  }
  
  /**
   * Calculate actual start time considering work center conflicts
   */
  private calculateActualStartTime(
    workOrder: WorkOrder,
    earliestStart: DateTime,
    _workCenter: import("./types").WorkCenter,
    scheduleByWorkCenter: Map<string, WorkOrder[]>
  ): { startTime: DateTime; blockingWorkOrder: string | null } {
    const scheduled = scheduleByWorkCenter.get(workOrder.data.workCenterId) || [];
    
    // Find the first available slot
    let candidateStart = earliestStart;
    let blockingWorkOrder: string | null = null;
    
    for (const scheduledOrder of scheduled) {
      const scheduledEnd = parseDate(scheduledOrder.data.endDate);
      
      if (candidateStart < scheduledEnd) {
        candidateStart = scheduledEnd;
        blockingWorkOrder = scheduledOrder.data.workOrderNumber;
      }
    }
    
    return { startTime: candidateStart, blockingWorkOrder };
  }

  /**
   * Validate that a work order can be scheduled
   * Throws error with detailed explanation if scheduling is impossible
   */
  private validateSchedulability(
    workOrder: WorkOrder,
    startDate: DateTime,
    requiredMinutes: number,
    workCenter: import("./types").WorkCenter
  ): void {
    // Check if work center has shifts defined
    if (!workCenter.data.shifts || workCenter.data.shifts.length === 0) {
      throw new Error(
        `Cannot schedule ${workOrder.data.workOrderNumber}: Work center "${workCenter.data.name}" has no shifts defined`
      );
    }

    // Calculate available work time within a reasonable window (e.g., 30 days from start)
    const maxEndDate = startDate.plus({ days: 30 });
    const availableMinutes = calculateAvailableWorkTime(
      startDate,
      maxEndDate,
      workCenter.data.shifts,
      workCenter.data.maintenanceWindows
    );

    // Check if we have enough available time
    if (availableMinutes < requiredMinutes) {
      // Calculate maintenance window time in the period
      let maintenanceBlockedMinutes = 0;
      for (const mw of workCenter.data.maintenanceWindows) {
        const mwStart = parseDate(mw.startDate);
        const mwEnd = parseDate(mw.endDate);
        
        if (mwStart < maxEndDate && mwEnd > startDate) {
          // Maintenance window overlaps with our period
          const overlapStart = mwStart > startDate ? mwStart : startDate;
          const overlapEnd = mwEnd < maxEndDate ? mwEnd : maxEndDate;
          
          // Only count time that's within shifts
          let blockedInShifts = 0;
          let checkTime = overlapStart;
          while (checkTime < overlapEnd) {
            if (isWithinShift(checkTime, workCenter.data.shifts)) {
              blockedInShifts += 60; // Approximate - check each hour
            }
            checkTime = checkTime.plus({ hours: 1 });
          }
          maintenanceBlockedMinutes += blockedInShifts;
        }
      }

      // Calculate total shift time available
      let totalShiftMinutes = 0;
      let checkDate = startDate;
      const daysChecked = new Set<string>();
      
      for (let i = 0; i < 30; i++) {
        const dayKey = checkDate.toISODate();
        if (!dayKey || daysChecked.has(dayKey)) break;
        daysChecked.add(dayKey);
        
        const dayOfWeek = checkDate.weekday === 7 ? 0 : checkDate.weekday;
        const shift = workCenter.data.shifts.find(s => s.dayOfWeek === dayOfWeek);
        
        if (shift) {
          const shiftStart = checkDate.set({ 
            hour: shift.startHour, 
            minute: 0, 
            second: 0, 
            millisecond: 0 
          });
          const shiftEnd = checkDate.set({ 
            hour: shift.endHour, 
            minute: 0, 
            second: 0, 
            millisecond: 0 
          });
          
          if (shiftEnd > startDate && shiftStart < maxEndDate) {
            const effectiveStart = shiftStart > startDate ? shiftStart : startDate;
            const effectiveEnd = shiftEnd < maxEndDate ? shiftEnd : maxEndDate;
            if (effectiveEnd > effectiveStart) {
              totalShiftMinutes += Math.floor(effectiveEnd.diff(effectiveStart, 'minutes').minutes);
            }
          }
        }
        
        checkDate = checkDate.plus({ days: 1 });
        if (checkDate >= maxEndDate) break;
      }

      const hoursRequired = Math.ceil(requiredMinutes / 60);
      const hoursAvailable = Math.floor(availableMinutes / 60);
      const hoursBlocked = Math.floor(maintenanceBlockedMinutes / 60);

      throw new Error(
        `Cannot schedule ${workOrder.data.workOrderNumber}: Requires ${hoursRequired} hours of work, ` +
        `but only ${hoursAvailable} hours are available in the next 30 days on work center "${workCenter.data.name}". ` +
        `Maintenance windows block ${hoursBlocked} hours. ` +
        `Consider: (1) Adjusting work order duration, (2) Adding more shifts, or (3) Reducing maintenance window durations.`
      );
    }

    // Additional check: Verify we can actually complete the work starting from the start date
    // This is done by attempting to calculate end time, but we'll validate it doesn't exceed reasonable limits
    try {
      const estimatedEnd = this.calculateEndTime(
        startDate,
        requiredMinutes,
        workCenter
      );
      
      // If estimated end is more than 30 days away, it's likely impossible
      if (estimatedEnd.diff(startDate, 'days').days > 30) {
        throw new Error(
          `Cannot schedule ${workOrder.data.workOrderNumber}: Work would take more than 30 days to complete ` +
          `starting from ${formatDate(startDate)} due to limited shift availability and maintenance windows on work center "${workCenter.data.name}". ` +
          `Required: ${Math.ceil(requiredMinutes / 60)} hours. Consider adjusting shifts or reducing maintenance windows.`
        );
      }
    } catch (error) {
      // If calculateEndTime throws an error (e.g., no shifts found), re-throw it
      if (error instanceof Error && error.message.includes('No available shifts')) {
        throw new Error(
          `Cannot schedule ${workOrder.data.workOrderNumber}: ${error.message} ` +
          `Work center "${workCenter.data.name}" has insufficient shift coverage to complete ${Math.ceil(requiredMinutes / 60)} hours of work.`
        );
      }
      throw error;
    }
  }
  
  /**
   * Calculate end time considering shifts and maintenance windows
   * 
   * This implements shift-aware duration calculation:
   * - Work pauses outside shift hours
   * - Work resumes at next shift start
   * - Maintenance windows block work time
   * - Tracks working minutes (not elapsed time)
   * - Setup time (if any) is included in total working time
   */
  private calculateEndTime(
    startDate: DateTime,
    durationMinutes: number,
    workCenter: import("./types").WorkCenter
  ): DateTime {
    let currentTime = startDate;
    let remainingMinutes = durationMinutes;
    let iterations = 0;
    const maxIterations = 10000; // Safety limit to prevent infinite loops
    
    // Ensure we start at a valid time (in shift, not in maintenance)
    currentTime = getNextAvailableTime(
      currentTime,
      workCenter.data.shifts,
      workCenter.data.maintenanceWindows
    );
    
    while (remainingMinutes > 0 && iterations < maxIterations) {
      iterations++;
      
      // If we're outside shift hours, jump to next shift
      if (!isWithinShift(currentTime, workCenter.data.shifts)) {
        const nextShift = getNextShiftStart(currentTime, workCenter.data.shifts);
        if (!nextShift) {
          throw new Error(`No available shifts found for work center ${workCenter.data.name}`);
        }
        currentTime = getNextAvailableTime(
          nextShift,
          workCenter.data.shifts,
          workCenter.data.maintenanceWindows
        );
        continue;
      }
      
      // If we're in a maintenance window, jump past it
      if (isInMaintenanceWindow(currentTime, workCenter.data.maintenanceWindows)) {
        currentTime = getNextAvailableTime(
          currentTime,
          workCenter.data.shifts,
          workCenter.data.maintenanceWindows
        );
        continue;
      }
      
      // We're in a shift and not in maintenance - calculate how much we can work
      const minutesUntilShiftEnd = getMinutesUntilShiftEnd(currentTime, workCenter.data.shifts);
      const minutesUntilMaintenance = getMinutesUntilMaintenanceWindow(
        currentTime,
        workCenter.data.maintenanceWindows
      );
      
      // Calculate how many minutes we can work now
      // Work the minimum of: remaining work, time until shift end, time until maintenance
      let minutesToWork = remainingMinutes;
      
      if (minutesUntilShiftEnd > 0) {
        minutesToWork = Math.min(minutesToWork, minutesUntilShiftEnd);
      }
      
      if (minutesUntilMaintenance !== null && minutesUntilMaintenance > 0) {
        minutesToWork = Math.min(minutesToWork, minutesUntilMaintenance);
      }
      
      // If we can't work any minutes, something is wrong - advance time
      if (minutesToWork <= 0) {
        currentTime = getNextAvailableTime(
          currentTime.plus({ minutes: 1 }),
          workCenter.data.shifts,
          workCenter.data.maintenanceWindows
        );
        continue;
      }
      
      // Work the calculated minutes
      currentTime = currentTime.plus({ minutes: minutesToWork });
      remainingMinutes -= minutesToWork;
    }
    
    if (iterations >= maxIterations) {
      throw new Error(`Shift-aware calculation exceeded maximum iterations. This may indicate an infinite loop.`);
    }
    
    return currentTime;
  }
  
  private generateChangeReason(
    workOrder: WorkOrder,
    newStart: DateTime,
    oldStart: DateTime,
    newEnd: DateTime,
    oldEnd: DateTime,
    blockingDependencies: string[],
    blockingWorkOrder: string | null,
    workCenter: import("./types").WorkCenter
  ): string {
    const delayMinutes = Math.round(newStart.diff(oldStart, "minutes").minutes);
    const endDelayMinutes = Math.round(newEnd.diff(oldEnd, "minutes").minutes);
    
    const reasons: string[] = [];
    
    // Dependency-related reasons
    if (blockingDependencies.length > 0) {
      if (blockingDependencies.length === 1) {
        reasons.push(`waiting for dependency ${blockingDependencies[0]} to complete`);
      } else {
        reasons.push(`waiting for dependencies (${blockingDependencies.join(", ")}) to complete`);
      }
    }
    
    // Work center conflict reasons
    if (blockingWorkOrder) {
      reasons.push(`work center conflict with ${blockingWorkOrder}`);
    }
    
    // Maintenance window reasons
    const originalStart = parseDate(workOrder.data.startDate);
    if (workCenter.data.maintenanceWindows.some((mw: { startDate: string; endDate: string }) => {
      const mwStart = parseDate(mw.startDate);
      const mwEnd = parseDate(mw.endDate);
      return (originalStart >= mwStart && originalStart < mwEnd) ||
             (newStart >= mwStart && newStart < mwEnd);
    })) {
      reasons.push("maintenance window avoidance");
    }
    
    // Shift boundary reasons
    if (delayMinutes > 0 && endDelayMinutes > delayMinutes) {
      reasons.push("shift boundary crossing (work pauses outside shift hours)");
    }
    
    // Build the explanation
    let explanation = "";
    if (delayMinutes > 0) {
      const hours = Math.floor(delayMinutes / 60);
      const minutes = delayMinutes % 60;
      const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      explanation = `Delayed by ${timeStr}`;
    } else if (delayMinutes < 0) {
      const hours = Math.floor(Math.abs(delayMinutes) / 60);
      const minutes = Math.abs(delayMinutes) % 60;
      const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      explanation = `Moved earlier by ${timeStr}`;
    } else if (endDelayMinutes !== 0) {
      explanation = "Schedule adjusted";
    } else {
      explanation = "Schedule adjusted";
    }
    
    if (reasons.length > 0) {
      if (reasons.length === 1) {
        explanation += ` due to ${reasons[0]}`;
      } else if (reasons.length === 2) {
        explanation += ` due to ${reasons[0]} and ${reasons[1]}`;
      } else {
        explanation += ` due to ${reasons.slice(0, -1).join(", ")}, and ${reasons[reasons.length - 1]}`;
      }
    } else {
      explanation += " to satisfy constraints";
    }
    
    return explanation;
  }
  
  private generateExplanation(changes: Change[]): string {
    if (changes.length === 0) {
      return "No changes required - schedule already valid.";
    }
    
    return `Rescheduled ${changes.length} work order(s) to satisfy constraints: dependencies, work center conflicts, shifts, and maintenance windows.`;
  }
}
