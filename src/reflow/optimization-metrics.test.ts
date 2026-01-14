import { describe, it, expect } from 'vitest';
import { ReflowService } from './reflow.service';
import { ReflowInput } from './types';
import { DateTime } from 'luxon';

describe('Optimization Metrics', () => {
  it('should calculate total delay introduced', () => {
    const input: ReflowInput = {
      workOrders: [
        {
          docId: 'wo-001',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-001',
            workCenterId: 'wc-line1',
            startDate: '2024-01-15T08:00:00Z', // Monday 8 AM
            endDate: '2024-01-15T12:00:00Z', // Monday 12 PM (4 hours)
            durationMinutes: 240,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
        {
          docId: 'wo-002',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-002',
            manufacturingOrderId: 'mo-002',
            workCenterId: 'wc-line1',
            startDate: '2024-01-15T08:00:00Z', // Monday 8 AM (conflicts with WO-001)
            endDate: '2024-01-15T10:00:00Z', // Monday 10 AM (2 hours)
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
      ],
      workCenters: [
        {
          docId: 'wc-line1',
          docType: 'workCenter',
          data: {
            name: 'Extrusion Line 1',
            shifts: [{ dayOfWeek: 1, startHour: 8, endHour: 17 }], // Mon 8 AM - 5 PM
            maintenanceWindows: [],
          },
        },
      ],
      manufacturingOrders: [],
    };

    const service = new ReflowService();
    const result = service.reflow(input);

    expect(result.metrics).toBeDefined();
    expect(result.metrics!.affectedWorkOrders).toBeGreaterThan(0);
    expect(result.metrics!.totalDelayMinutes).toBeGreaterThanOrEqual(0);
    expect(result.metrics!.totalDelayHours).toBeGreaterThanOrEqual(0);
  });

  it('should calculate utilization metrics per work center', () => {
    const input: ReflowInput = {
      workOrders: [
        {
          docId: 'wo-001',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-001',
            workCenterId: 'wc-line1',
            startDate: '2024-01-15T08:00:00Z',
            endDate: '2024-01-15T12:00:00Z',
            durationMinutes: 240, // 4 hours
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
      ],
      workCenters: [
        {
          docId: 'wc-line1',
          docType: 'workCenter',
          data: {
            name: 'Extrusion Line 1',
            shifts: [{ dayOfWeek: 1, startHour: 8, endHour: 17 }], // 9 hours available
            maintenanceWindows: [],
          },
        },
      ],
      manufacturingOrders: [],
    };

    const service = new ReflowService();
    const result = service.reflow(input);

    expect(result.metrics).toBeDefined();
    expect(result.metrics!.utilizationByWorkCenter).toBeDefined();
    expect(result.metrics!.utilizationByWorkCenter.has('wc-line1')).toBe(true);

    const wcMetrics = result.metrics!.utilizationByWorkCenter.get('wc-line1');
    expect(wcMetrics).toBeDefined();
    expect(wcMetrics!.totalWorkingMinutes).toBe(240); // 4 hours
    expect(wcMetrics!.totalAvailableMinutes).toBeGreaterThan(0);
    expect(wcMetrics!.utilizationPercent).toBeGreaterThanOrEqual(0);
    expect(wcMetrics!.utilizationPercent).toBeLessThanOrEqual(100);
    expect(wcMetrics!.idleTimeMinutes).toBeGreaterThanOrEqual(0);
  });

  it('should calculate overall utilization', () => {
    const input: ReflowInput = {
      workOrders: [
        {
          docId: 'wo-001',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-001',
            workCenterId: 'wc-line1',
            startDate: '2024-01-15T08:00:00Z',
            endDate: '2024-01-15T12:00:00Z',
            durationMinutes: 240,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
        {
          docId: 'wo-002',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-002',
            manufacturingOrderId: 'mo-002',
            workCenterId: 'wc-line2',
            startDate: '2024-01-15T08:00:00Z',
            endDate: '2024-01-15T10:00:00Z',
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
      ],
      workCenters: [
        {
          docId: 'wc-line1',
          docType: 'workCenter',
          data: {
            name: 'Extrusion Line 1',
            shifts: [{ dayOfWeek: 1, startHour: 8, endHour: 17 }],
            maintenanceWindows: [],
          },
        },
        {
          docId: 'wc-line2',
          docType: 'workCenter',
          data: {
            name: 'Extrusion Line 2',
            shifts: [{ dayOfWeek: 1, startHour: 8, endHour: 17 }],
            maintenanceWindows: [],
          },
        },
      ],
      manufacturingOrders: [],
    };

    const service = new ReflowService();
    const result = service.reflow(input);

    expect(result.metrics).toBeDefined();
    expect(result.metrics!.overallUtilizationPercent).toBeGreaterThanOrEqual(0);
    expect(result.metrics!.overallUtilizationPercent).toBeLessThanOrEqual(100);
    expect(result.metrics!.totalIdleTimeMinutes).toBeGreaterThanOrEqual(0);
  });

  it('should include setup time in working minutes', () => {
    const input: ReflowInput = {
      workOrders: [
        {
          docId: 'wo-001',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-001',
            workCenterId: 'wc-line1',
            startDate: '2024-01-15T08:00:00Z',
            endDate: '2024-01-15T12:00:00Z',
            durationMinutes: 180, // 3 hours production
            setupTimeMinutes: 60, // 1 hour setup
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
      ],
      workCenters: [
        {
          docId: 'wc-line1',
          docType: 'workCenter',
          data: {
            name: 'Extrusion Line 1',
            shifts: [{ dayOfWeek: 1, startHour: 8, endHour: 17 }],
            maintenanceWindows: [],
          },
        },
      ],
      manufacturingOrders: [],
    };

    const service = new ReflowService();
    const result = service.reflow(input);

    expect(result.metrics).toBeDefined();
    const wcMetrics = result.metrics!.utilizationByWorkCenter.get('wc-line1');
    expect(wcMetrics).toBeDefined();
    // Total working minutes should include setup time: 180 + 60 = 240
    expect(wcMetrics!.totalWorkingMinutes).toBe(240);
  });

  it('should handle work centers with no work orders', () => {
    const input: ReflowInput = {
      workOrders: [],
      workCenters: [
        {
          docId: 'wc-line1',
          docType: 'workCenter',
          data: {
            name: 'Extrusion Line 1',
            shifts: [{ dayOfWeek: 1, startHour: 8, endHour: 17 }],
            maintenanceWindows: [],
          },
        },
      ],
      manufacturingOrders: [],
    };

    const service = new ReflowService();
    const result = service.reflow(input);

    expect(result.metrics).toBeDefined();
    expect(result.metrics!.affectedWorkOrders).toBe(0);
    expect(result.metrics!.totalDelayMinutes).toBe(0);
    expect(result.metrics!.totalDelayHours).toBe(0);
    
    const wcMetrics = result.metrics!.utilizationByWorkCenter.get('wc-line1');
    expect(wcMetrics).toBeDefined();
    expect(wcMetrics!.totalWorkingMinutes).toBe(0);
    expect(wcMetrics!.totalAvailableMinutes).toBe(0);
    expect(wcMetrics!.utilizationPercent).toBe(0);
    expect(wcMetrics!.idleTimeMinutes).toBe(0);
  });

  it('should calculate metrics when no changes are made', () => {
    const input: ReflowInput = {
      workOrders: [
        {
          docId: 'wo-001',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-001',
            workCenterId: 'wc-line1',
            startDate: '2024-01-15T08:00:00Z',
            endDate: '2024-01-15T12:00:00Z',
            durationMinutes: 240,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
      ],
      workCenters: [
        {
          docId: 'wc-line1',
          docType: 'workCenter',
          data: {
            name: 'Extrusion Line 1',
            shifts: [{ dayOfWeek: 1, startHour: 8, endHour: 17 }],
            maintenanceWindows: [],
          },
        },
      ],
      manufacturingOrders: [],
    };

    const service = new ReflowService();
    const result = service.reflow(input);

    expect(result.metrics).toBeDefined();
    // Even if no changes are made, metrics should still be calculated
    expect(result.metrics!.totalWorkOrders).toBe(1);
  });
});
