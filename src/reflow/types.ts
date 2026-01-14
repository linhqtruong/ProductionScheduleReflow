/**
 * Core types for the Production Schedule Reflow system
 */

export interface Document {
  docId: string;
  docType: string;
  data: Record<string, unknown>;
}

export interface WorkOrder extends Document {
  docType: "workOrder";
  data: {
    workOrderNumber: string;
    manufacturingOrderId: string;
    workCenterId: string;
    startDate: string;
    endDate: string;
    durationMinutes: number;
    isMaintenance: boolean;
    dependsOnWorkOrderIds: string[];
    setupTimeMinutes?: number; // Optional setup time before production starts
  };
}

export interface WorkCenter extends Document {
  docType: "workCenter";
  data: {
    name: string;
    shifts: Array<{
      dayOfWeek: number; // 0-6, Sunday = 0
      startHour: number; // 0-23
      endHour: number; // 0-23
    }>;
    maintenanceWindows: Array<{
      startDate: string;
      endDate: string;
      reason?: string;
    }>;
  };
}

export interface ManufacturingOrder extends Document {
  docType: "manufacturingOrder";
  data: {
    manufacturingOrderNumber: string;
    itemId: string;
    quantity: number;
    dueDate: string;
  };
}

export interface ReflowInput {
  workOrders: WorkOrder[];
  workCenters: WorkCenter[];
  manufacturingOrders: ManufacturingOrder[];
}

export interface Change {
  workOrderId: string;
  workOrderNumber: string;
  oldStartDate: string;
  newStartDate: string;
  oldEndDate: string;
  newEndDate: string;
  reason: string;
}

export interface OptimizationMetrics {
  totalDelayMinutes: number; // Total delay introduced: Σ (new_end_date - original_end_date)
  totalDelayHours: number; // Total delay in hours
  affectedWorkOrders: number; // Number of work orders that changed
  totalWorkOrders: number; // Total number of work orders
  utilizationByWorkCenter: Map<string, {
    totalWorkingMinutes: number;
    totalAvailableMinutes: number;
    utilizationPercent: number;
    idleTimeMinutes: number;
  }>;
  overallUtilizationPercent: number; // Average utilization across all work centers
  totalIdleTimeMinutes: number; // Total idle time across all work centers
}

export interface ReflowResult {
  updatedWorkOrders: WorkOrder[];
  changes: Change[];
  explanation: string;
  dagInfo?: {
    hasCycles: boolean;
    cycles: string[][];
    rootNodes: string[];
    leafNodes: string[];
  };
  metrics?: OptimizationMetrics; // Optional optimization metrics
}
