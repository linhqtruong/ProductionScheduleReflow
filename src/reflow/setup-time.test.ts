import { describe, it, expect } from 'vitest';
import { ReflowService } from './reflow.service';
import { ReflowInput } from './types';
import { DateTime } from 'luxon';

describe('Setup Time Handling', () => {
  it('should include setup time in total work duration', () => {
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
            durationMinutes: 180, // 3 hours of production
            setupTimeMinutes: 60, // 1 hour of setup
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
            shifts: [
              { dayOfWeek: 1, startHour: 8, endHour: 17 },
            ],
            maintenanceWindows: [],
          },
        },
      ],
      manufacturingOrders: [],
    };

    const service = new ReflowService();
    const result = service.reflow(input);

    const wo001 = result.updatedWorkOrders.find((wo) => wo.data.workOrderNumber === 'WO-001');
    expect(wo001).toBeDefined();

    const startDate = DateTime.fromISO(wo001!.data.startDate);
    const endDate = DateTime.fromISO(wo001!.data.endDate);

    // Total work time should be setup (60 min) + production (180 min) = 240 minutes
    // Starting at 8 AM, should end at 12 PM (4 hours later)
    const totalMinutes = endDate.diff(startDate, 'minutes').minutes;
    
    // Should account for at least 240 minutes of working time
    // (may be more if shift boundaries are crossed)
    expect(totalMinutes).toBeGreaterThanOrEqual(240);
  });

  it('should handle setup time across shift boundaries', () => {
    const input: ReflowInput = {
      workOrders: [
        {
          docId: 'wo-001',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-001',
            workCenterId: 'wc-line1',
            startDate: '2024-01-15T16:00:00Z', // 4 PM
            endDate: '2024-01-15T20:00:00Z',
            durationMinutes: 120, // 2 hours production
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
            shifts: [
              { dayOfWeek: 1, startHour: 8, endHour: 17 }, // 8 AM - 5 PM
              { dayOfWeek: 2, startHour: 8, endHour: 17 },
            ],
            maintenanceWindows: [],
          },
        },
      ],
      manufacturingOrders: [],
    };

    const service = new ReflowService();
    const result = service.reflow(input);

    const wo001 = result.updatedWorkOrders.find((wo) => wo.data.workOrderNumber === 'WO-001');
    expect(wo001).toBeDefined();

    const startDate = DateTime.fromISO(wo001!.data.startDate);
    const endDate = DateTime.fromISO(wo001!.data.endDate);

    // Total: 60 min setup + 120 min production = 180 minutes
    // Starts at 4 PM, works 1 hour (4 PM - 5 PM), pauses at shift end
    // Resumes Tuesday 8 AM, works remaining 2 hours (8 AM - 10 AM)
    // Should end Tuesday 10 AM
    expect(endDate.day).toBe(16); // Tuesday
    // Should be in shift hours (8 AM - 5 PM)
    if (endDate.hour < 8) {
      // If before 8 AM, it means it's still completing from previous day
      expect(endDate.day).toBeGreaterThan(startDate.day);
    } else {
      expect(endDate.hour).toBeGreaterThanOrEqual(8);
      expect(endDate.hour).toBeLessThan(17);
    }
  });

  it('should handle work orders without setup time', () => {
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
            // No setupTimeMinutes - should work normally
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
            shifts: [
              { dayOfWeek: 1, startHour: 8, endHour: 17 },
            ],
            maintenanceWindows: [],
          },
        },
      ],
      manufacturingOrders: [],
    };

    const service = new ReflowService();
    const result = service.reflow(input);

    const wo001 = result.updatedWorkOrders.find((wo) => wo.data.workOrderNumber === 'WO-001');
    expect(wo001).toBeDefined();

    // Should work normally without setup time
    const startDate = DateTime.fromISO(wo001!.data.startDate);
    const endDate = DateTime.fromISO(wo001!.data.endDate);
    const totalMinutes = endDate.diff(startDate, 'minutes').minutes;
    
    // Should account for 240 minutes
    expect(totalMinutes).toBeGreaterThanOrEqual(240);
  });

  it('should handle setup time with maintenance windows', () => {
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
            endDate: '2024-01-15T14:00:00Z',
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
            shifts: [
              { dayOfWeek: 1, startHour: 8, endHour: 17 },
            ],
            maintenanceWindows: [
              {
                startDate: '2024-01-15T12:00:00Z',
                endDate: '2024-01-15T13:00:00Z',
                reason: 'Lunch break',
              },
            ],
          },
        },
      ],
      manufacturingOrders: [],
    };

    const service = new ReflowService();
    const result = service.reflow(input);

    const wo001 = result.updatedWorkOrders.find((wo) => wo.data.workOrderNumber === 'WO-001');
    expect(wo001).toBeDefined();

    // Total: 60 min setup + 180 min production = 240 minutes
    // Should skip maintenance window (12 PM - 1 PM)
    // Works 4 hours (8 AM - 12 PM), skips 1 hour, works remaining time
    const startDate = DateTime.fromISO(wo001!.data.startDate);
    const endDate = DateTime.fromISO(wo001!.data.endDate);
    const totalMinutes = endDate.diff(startDate, 'minutes').minutes;
    
    // Should account for 240 minutes of work
    // If maintenance window is skipped, elapsed time will be longer
    // But the minimum should be 240 minutes of working time
    expect(totalMinutes).toBeGreaterThanOrEqual(240);
  });
});
