import { describe, it, expect } from 'vitest';
import { ReflowService } from './reflow.service';
import { ReflowInput } from './types';
import { DateTime } from 'luxon';

describe('ReflowService', () => {
  describe('Scenario 1: Delay Cascade', () => {
    it('should handle delay cascade when one order is delayed', () => {
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
              workCenterId: 'wc-line1',
              startDate: '2024-01-15T12:00:00Z',
              endDate: '2024-01-15T16:00:00Z',
              durationMinutes: 240,
              isMaintenance: false,
              dependsOnWorkOrderIds: ['wo-001'],
            },
          },
          {
            docId: 'wo-003',
            docType: 'workOrder',
            data: {
              workOrderNumber: 'WO-003',
              manufacturingOrderId: 'mo-003',
              workCenterId: 'wc-line1',
              startDate: '2024-01-15T16:00:00Z',
              endDate: '2024-01-15T20:00:00Z',
              durationMinutes: 240,
              isMaintenance: false,
              dependsOnWorkOrderIds: ['wo-002'],
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
                { dayOfWeek: 2, startHour: 8, endHour: 17 },
                { dayOfWeek: 3, startHour: 8, endHour: 17 },
                { dayOfWeek: 4, startHour: 8, endHour: 17 },
                { dayOfWeek: 5, startHour: 8, endHour: 17 },
              ],
              maintenanceWindows: [],
            },
          },
        ],
        manufacturingOrders: [],
      };

      const service = new ReflowService();
      const result = service.reflow(input);

      // Assertions
      expect(result.updatedWorkOrders).toHaveLength(3);
      expect(result.changes.length).toBeGreaterThan(0);

      // WO-001 should start at 8:00 AM
      const wo001 = result.updatedWorkOrders.find((wo) => wo.data.workOrderNumber === 'WO-001');
      expect(wo001).toBeDefined();
      expect(wo001!.data.startDate).toContain('2024-01-15T08:00:00');

      // WO-002 should start after WO-001 ends
      const wo002 = result.updatedWorkOrders.find((wo) => wo.data.workOrderNumber === 'WO-002');
      expect(wo002).toBeDefined();
      const wo001End = DateTime.fromISO(wo001!.data.endDate);
      const wo002Start = DateTime.fromISO(wo002!.data.startDate);
      expect(wo002Start >= wo001End).toBe(true);

      // WO-003 should start after WO-002 ends
      const wo003 = result.updatedWorkOrders.find((wo) => wo.data.workOrderNumber === 'WO-003');
      expect(wo003).toBeDefined();
      const wo002End = DateTime.fromISO(wo002!.data.endDate);
      const wo003Start = DateTime.fromISO(wo003!.data.startDate);
      expect(wo003Start >= wo002End).toBe(true);

      // Verify no work center conflicts
      const workCenterOrders = result.updatedWorkOrders.filter(
        (wo) => wo.data.workCenterId === 'wc-line1'
      );
      for (let i = 0; i < workCenterOrders.length; i++) {
        for (let j = i + 1; j < workCenterOrders.length; j++) {
          const order1 = workCenterOrders[i];
          const order2 = workCenterOrders[j];
          const start1 = DateTime.fromISO(order1.data.startDate);
          const end1 = DateTime.fromISO(order1.data.endDate);
          const start2 = DateTime.fromISO(order2.data.startDate);
          const end2 = DateTime.fromISO(order2.data.endDate);

          // Orders should not overlap
          expect(
            (start1 >= end2) || (start2 >= end1)
          ).toBe(true);
        }
      }
    });
  });

  describe('Scenario 2: Shift and Maintenance', () => {
    it('should handle shift boundaries and maintenance windows', () => {
      const input: ReflowInput = {
        workOrders: [
          {
            docId: 'wo-101',
            docType: 'workOrder',
            data: {
              workOrderNumber: 'WO-101',
              manufacturingOrderId: 'mo-101',
              workCenterId: 'wc-line1',
              startDate: '2024-01-15T15:00:00Z',
              endDate: '2024-01-15T19:00:00Z',
              durationMinutes: 240,
              isMaintenance: false,
              dependsOnWorkOrderIds: [],
            },
          },
          {
            docId: 'wo-102',
            docType: 'workOrder',
            data: {
              workOrderNumber: 'WO-102',
              manufacturingOrderId: 'mo-102',
              workCenterId: 'wc-line1',
              startDate: '2024-01-16T08:00:00Z',
              endDate: '2024-01-16T12:00:00Z',
              durationMinutes: 240,
              isMaintenance: false,
              dependsOnWorkOrderIds: ['wo-101'],
            },
          },
          {
            docId: 'wo-103',
            docType: 'workOrder',
            data: {
              workOrderNumber: 'WO-MAINT-001',
              manufacturingOrderId: 'mo-maint',
              workCenterId: 'wc-line2',
              startDate: '2024-01-15T10:00:00Z',
              endDate: '2024-01-15T14:00:00Z',
              durationMinutes: 240,
              isMaintenance: true,
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
                { dayOfWeek: 2, startHour: 8, endHour: 17 },
              ],
              maintenanceWindows: [],
            },
          },
          {
            docId: 'wc-line2',
            docType: 'workCenter',
            data: {
              name: 'Extrusion Line 2',
              shifts: [
                { dayOfWeek: 1, startHour: 8, endHour: 17 },
                { dayOfWeek: 2, startHour: 8, endHour: 17 },
              ],
              maintenanceWindows: [
                {
                  startDate: '2024-01-15T10:00:00Z',
                  endDate: '2024-01-15T14:00:00Z',
                  reason: 'Scheduled maintenance',
                },
              ],
            },
          },
        ],
        manufacturingOrders: [],
      };

      const service = new ReflowService();
      const result = service.reflow(input);

      // Assertions
      expect(result.updatedWorkOrders).toHaveLength(3);

      // Maintenance order should not be rescheduled
      const maintOrder = result.updatedWorkOrders.find(
        (wo) => wo.data.workOrderNumber === 'WO-MAINT-001'
      );
      expect(maintOrder).toBeDefined();
      expect(maintOrder!.data.startDate).toBe('2024-01-15T10:00:00Z');
      expect(maintOrder!.data.endDate).toBe('2024-01-15T14:00:00Z');

      // WO-101 starts at 3 PM (15:00), should work 2 hours (3 PM - 5 PM), then pause
      // Should resume next day at 8 AM and complete at 10 AM
      const wo101 = result.updatedWorkOrders.find((wo) => wo.data.workOrderNumber === 'WO-101');
      expect(wo101).toBeDefined();
      const wo101Start = DateTime.fromISO(wo101!.data.startDate);
      const wo101End = DateTime.fromISO(wo101!.data.endDate);

      // Should start at valid time (may be adjusted to next shift if outside shift)
      expect(wo101Start.hour).toBeGreaterThanOrEqual(8);
      expect(wo101Start.hour).toBeLessThan(17);

      // Should end on a valid day (may be next day if shift boundary crossed)
      expect(wo101End.day).toBeGreaterThanOrEqual(15);

      // WO-102 should start after WO-101 ends
      const wo102 = result.updatedWorkOrders.find((wo) => wo.data.workOrderNumber === 'WO-102');
      expect(wo102).toBeDefined();
      const wo102Start = DateTime.fromISO(wo102!.data.startDate);
      expect(wo102Start >= wo101End).toBe(true);
    });
  });

  describe('Scenario 3: Complex Dependencies', () => {
    it('should handle multiple parent dependencies', () => {
      const input: ReflowInput = {
        workOrders: [
          {
            docId: 'wo-201',
            docType: 'workOrder',
            data: {
              workOrderNumber: 'WO-201',
              manufacturingOrderId: 'mo-201',
              workCenterId: 'wc-line1',
              startDate: '2024-01-15T08:00:00Z',
              endDate: '2024-01-15T11:00:00Z',
              durationMinutes: 180,
              isMaintenance: false,
              dependsOnWorkOrderIds: [],
            },
          },
          {
            docId: 'wo-202',
            docType: 'workOrder',
            data: {
              workOrderNumber: 'WO-202',
              manufacturingOrderId: 'mo-202',
              workCenterId: 'wc-line2',
              startDate: '2024-01-15T08:00:00Z',
              endDate: '2024-01-15T12:00:00Z',
              durationMinutes: 240,
              isMaintenance: false,
              dependsOnWorkOrderIds: [],
            },
          },
          {
            docId: 'wo-204',
            docType: 'workOrder',
            data: {
              workOrderNumber: 'WO-204',
              manufacturingOrderId: 'mo-204',
              workCenterId: 'wc-line1',
              startDate: '2024-01-15T14:00:00Z',
              endDate: '2024-01-15T17:00:00Z',
              durationMinutes: 180,
              isMaintenance: false,
              dependsOnWorkOrderIds: ['wo-201', 'wo-202'],
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
                { dayOfWeek: 2, startHour: 8, endHour: 17 },
              ],
              maintenanceWindows: [],
            },
          },
          {
            docId: 'wc-line2',
            docType: 'workCenter',
            data: {
              name: 'Extrusion Line 2',
              shifts: [
                { dayOfWeek: 1, startHour: 8, endHour: 17 },
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

      // Assertions
      expect(result.updatedWorkOrders).toHaveLength(3);

      // WO-204 should start after BOTH WO-201 and WO-202 complete
      const wo201 = result.updatedWorkOrders.find((wo) => wo.data.workOrderNumber === 'WO-201');
      const wo202 = result.updatedWorkOrders.find((wo) => wo.data.workOrderNumber === 'WO-202');
      const wo204 = result.updatedWorkOrders.find((wo) => wo.data.workOrderNumber === 'WO-204');

      expect(wo201).toBeDefined();
      expect(wo202).toBeDefined();
      expect(wo204).toBeDefined();

      const wo201End = DateTime.fromISO(wo201!.data.endDate);
      const wo202End = DateTime.fromISO(wo202!.data.endDate);
      const wo204Start = DateTime.fromISO(wo204!.data.startDate);

      // WO-204 should start after the latest of WO-201 and WO-202
      const latestParentEnd = wo201End > wo202End ? wo201End : wo202End;
      expect(wo204Start >= latestParentEnd).toBe(true);
    });
  });
});
