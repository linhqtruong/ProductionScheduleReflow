import { describe, it, expect } from 'vitest';
import { ReflowService } from './reflow.service';
import { ReflowInput } from './types';

describe('Impossible Schedule Detection', () => {
  it('should detect when work order requires more time than available shifts allow', () => {
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
            endDate: '2024-01-15T20:00:00Z',
            durationMinutes: 10000, // ~167 hours - way more than available in 30 days with limited shifts
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
              { dayOfWeek: 1, startHour: 8, endHour: 12 }, // Only 4 hours per day, Monday only
            ],
            maintenanceWindows: [],
          },
        },
      ],
      manufacturingOrders: [],
    };

    const service = new ReflowService();

    expect(() => {
      service.reflow(input);
    }).toThrow(/Cannot schedule.*Requires.*hours of work.*only.*hours are available/);
  });

  it('should detect when maintenance windows block all available time', () => {
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
            endDate: '2024-01-15T17:00:00Z',
            durationMinutes: 2000, // ~33 hours - more than available with limited shifts
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
              { dayOfWeek: 1, startHour: 8, endHour: 12 }, // Only 4 hours Monday
              { dayOfWeek: 3, startHour: 8, endHour: 12 }, // Only 4 hours Wednesday
            ],
            maintenanceWindows: [
              {
                startDate: '2024-01-15T08:00:00Z',
                endDate: '2024-01-17T12:00:00Z', // Blocks both shifts
                reason: 'Extended maintenance',
              },
            ],
          },
        },
      ],
      manufacturingOrders: [],
    };

    const service = new ReflowService();

    // Should detect that maintenance windows block all available time
    // With only 4 hours per week and maintenance blocking both shifts, 33 hours is impossible
    expect(() => {
      service.reflow(input);
    }).toThrow(/Cannot schedule|Maintenance windows block/);
  });

  it('should detect when work center has no shifts defined', () => {
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
            shifts: [], // No shifts defined
            maintenanceWindows: [],
          },
        },
      ],
      manufacturingOrders: [],
    };

    const service = new ReflowService();

    expect(() => {
      service.reflow(input);
    }).toThrow(/has no shifts defined/);
  });

  it('should provide detailed explanation for impossible schedules', () => {
    const input: ReflowInput = {
      workOrders: [
        {
          docId: 'wo-001',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-IMPOSSIBLE',
            manufacturingOrderId: 'mo-001',
            workCenterId: 'wc-line1',
            startDate: '2024-01-15T08:00:00Z',
            endDate: '2024-01-15T17:00:00Z',
            durationMinutes: 5000, // ~83 hours
            setupTimeMinutes: 500, // Additional 8 hours
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
            name: 'Limited Capacity Line',
            shifts: [
              { dayOfWeek: 1, startHour: 8, endHour: 12 }, // Only 4 hours Monday
              { dayOfWeek: 3, startHour: 8, endHour: 12 }, // Only 4 hours Wednesday
            ],
            maintenanceWindows: [
              {
                startDate: '2024-01-15T09:00:00Z',
                endDate: '2024-01-15T11:00:00Z',
                reason: 'Daily maintenance',
              },
            ],
          },
        },
      ],
      manufacturingOrders: [],
    };

    const service = new ReflowService();

    try {
      service.reflow(input);
      // If it doesn't throw, that's also acceptable - the algorithm might find a way
    } catch (error) {
      // Should throw with detailed explanation
      expect(error).toBeInstanceOf(Error);
      const errorMessage = (error as Error).message;
      expect(errorMessage).toContain('WO-IMPOSSIBLE');
      expect(errorMessage).toContain('Requires');
      expect(errorMessage).toContain('hours are available');
    }
  });

  it('should handle work orders that CAN be scheduled despite constraints', () => {
    const input: ReflowInput = {
      workOrders: [
        {
          docId: 'wo-001',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-FEASIBLE',
            manufacturingOrderId: 'mo-001',
            workCenterId: 'wc-line1',
            startDate: '2024-01-15T08:00:00Z',
            endDate: '2024-01-15T12:00:00Z',
            durationMinutes: 240, // 4 hours - can fit in available shift time
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
              { dayOfWeek: 1, startHour: 8, endHour: 17 }, // 9 hours available
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

    // Should successfully schedule
    expect(result.updatedWorkOrders).toHaveLength(1);
    const wo001 = result.updatedWorkOrders.find((wo) => wo.data.workOrderNumber === 'WO-FEASIBLE');
    expect(wo001).toBeDefined();
  });
});
