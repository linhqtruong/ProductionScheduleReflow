/**
 * Script to generate a large-scale sample data file with 1000+ work orders
 * Tests all constraints: dependencies, work centers, shifts, maintenance windows
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const NUM_WORK_ORDERS = 1200;
const NUM_WORK_CENTERS = 18;
const NUM_MANUFACTURING_ORDERS = 150;
const BASE_DATE = '2024-01-15T08:00:00Z';

// Generate work centers
function generateWorkCenters(count) {
  const centers = [];
  const centerNames = [
    'Extrusion Line 1', 'Extrusion Line 2', 'Extrusion Line 3',
    'Assembly Line A', 'Assembly Line B', 'Assembly Line C',
    'Packaging Line 1', 'Packaging Line 2',
    'Quality Control 1', 'Quality Control 2',
    'Coating Station 1', 'Coating Station 2',
    'Machining Center 1', 'Machining Center 2', 'Machining Center 3',
    'Welding Station', 'Cutting Station', 'Finishing Station'
  ];

  for (let i = 0; i < count; i++) {
    const name = centerNames[i] || `Work Center ${i + 1}`;
    const wcId = `wc-${i + 1}`;
    
    // Standard weekday shifts (8 AM - 5 PM)
    const shifts = [1, 2, 3, 4, 5].map(day => ({
      dayOfWeek: day,
      startHour: 8,
      endHour: 17
    }));

    // Some work centers have weekend shifts
    if (i < 6) {
      shifts.push(
        { dayOfWeek: 6, startHour: 8, endHour: 14 } // Saturday half day
      );
    }

    // Maintenance windows - randomly distributed
    const maintenanceWindows = [];
    if (i < 5) {
      // First 5 centers have maintenance windows
      const baseDate = new Date(BASE_DATE);
      baseDate.setDate(baseDate.getDate() + Math.floor(i / 2));
      const maintStart = new Date(baseDate);
      maintStart.setHours(12, 0, 0, 0);
      const maintEnd = new Date(maintStart);
      maintEnd.setHours(13, 30, 0, 0);
      
      maintenanceWindows.push({
        startDate: maintStart.toISOString(),
        endDate: maintEnd.toISOString(),
        reason: `Scheduled maintenance for ${name}`
      });
    }

    centers.push({
      docId: wcId,
      docType: 'workCenter',
      data: {
        name,
        shifts,
        maintenanceWindows
      }
    });
  }

  return centers;
}

// Generate manufacturing orders
function generateManufacturingOrders(count) {
  const orders = [];
  const baseDate = new Date(BASE_DATE);
  
  for (let i = 0; i < count; i++) {
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + 7 + (i % 14)); // Spread over 2 weeks
    
    orders.push({
      docId: `mo-${String(i + 1).padStart(4, '0')}`,
      docType: 'manufacturingOrder',
      data: {
        manufacturingOrderNumber: `MO-${String(i + 1).padStart(4, '0')}`,
        itemId: `ITEM-${String((i % 50) + 1).padStart(3, '0')}`,
        quantity: 100 + (i % 500) * 10,
        dueDate: dueDate.toISOString()
      }
    });
  }

  return orders;
}

// Generate work orders with complex dependencies
function generateWorkOrders(count, workCenters, manufacturingOrders) {
  const orders = [];
  const baseDate = new Date(BASE_DATE);
  const dependencyChains = [];
  
  // Create 20 root chains (groups of dependent orders)
  const chainSizes = [];
  let remaining = count - 50; // Reserve 50 for independent/maintenance orders
  
  for (let i = 0; i < 20; i++) {
    const chainSize = Math.min(30 + Math.floor(Math.random() * 40), remaining);
    chainSizes.push(chainSize);
    remaining -= chainSize;
    if (remaining <= 0) break;
  }
  
  let woIndex = 0;
  const woToMoMap = new Map();

  // Generate maintenance orders (fixed, non-movable)
  for (let i = 0; i < 20; i++) {
    const wcIndex = i % workCenters.length;
    const workCenter = workCenters[wcIndex];
    const startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() + Math.floor(i / 5));
    startDate.setHours(10 + (i % 8), 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 2, 30, 0);

    orders.push({
      docId: `wo-maint-${String(i + 1).padStart(3, '0')}`,
      docType: 'workOrder',
      data: {
        workOrderNumber: `WO-MAINT-${String(i + 1).padStart(3, '0')}`,
        manufacturingOrderId: `mo-maint-${String(i + 1).padStart(3, '0')}`,
        workCenterId: workCenter.docId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        durationMinutes: 150,
        isMaintenance: true,
        dependsOnWorkOrderIds: []
      }
    });
  }

  woIndex = 20;

  // Generate dependency chains
  chainSizes.forEach((chainSize, chainIndex) => {
    const chainStartWoIndex = woIndex;
    const chainWos = [];
    
    for (let i = 0; i < chainSize; i++) {
      const wcIndex = (chainIndex * 3 + i) % workCenters.length;
      const workCenter = workCenters[wcIndex];
      const moIndex = (woIndex * 2) % manufacturingOrders.length;
      const manufacturingOrder = manufacturingOrders[moIndex];
      
      const startDate = new Date(baseDate);
      startDate.setDate(startDate.getDate() + Math.floor(woIndex / 50));
      startDate.setHours(8 + (woIndex % 9), (woIndex * 7) % 60, 0, 0);
      
      const durationMinutes = 60 + (woIndex % 240); // 1-5 hours
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + durationMinutes);

      const dependsOn = [];
      if (i > 0) {
        // Each order depends on previous in chain
        dependsOn.push(`wo-${String(chainStartWoIndex + i - 1).padStart(4, '0')}`);
      }
      
      // Some orders have multiple dependencies (branching)
      if (i > 2 && i % 5 === 0) {
        const prevChainWoIndex = chainStartWoIndex + i - 3;
        if (prevChainWoIndex >= 20) {
          dependsOn.push(`wo-${String(prevChainWoIndex).padStart(4, '0')}`);
        }
      }

      const woId = `wo-${String(woIndex).padStart(4, '0')}`;
      chainWos.push(woId);

      orders.push({
        docId: woId,
        docType: 'workOrder',
        data: {
          workOrderNumber: `WO-${String(woIndex).padStart(4, '0')}`,
          manufacturingOrderId: manufacturingOrder.docId,
          workCenterId: workCenter.docId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          durationMinutes,
          isMaintenance: false,
          dependsOnWorkOrderIds: dependsOn
        }
      });

      woIndex++;
    }

    dependencyChains.push(chainWos);
  });

  // Generate independent work orders (no dependencies)
  const remainingCount = count - woIndex;
  for (let i = 0; i < Math.min(remainingCount, 30); i++) {
    const wcIndex = woIndex % workCenters.length;
    const workCenter = workCenters[wcIndex];
    const moIndex = woIndex % manufacturingOrders.length;
    const manufacturingOrder = manufacturingOrders[moIndex];
    
    const startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() + Math.floor(woIndex / 80));
    startDate.setHours(8 + (woIndex % 9), (woIndex * 11) % 60, 0, 0);
    
    const durationMinutes = 90 + (woIndex % 180);
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + durationMinutes);

    orders.push({
      docId: `wo-${String(woIndex).padStart(4, '0')}`,
      docType: 'workOrder',
      data: {
        workOrderNumber: `WO-${String(woIndex).padStart(4, '0')}`,
        manufacturingOrderId: manufacturingOrder.docId,
        workCenterId: workCenter.docId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        durationMinutes,
        isMaintenance: false,
        dependsOnWorkOrderIds: []
      }
    });

    woIndex++;
  }

  return orders;
}

// Main generation
console.log('Generating large-scale sample data...');
const workCenters = generateWorkCenters(NUM_WORK_CENTERS);
console.log(`Generated ${workCenters.length} work centers`);

const manufacturingOrders = generateManufacturingOrders(NUM_MANUFACTURING_ORDERS);
console.log(`Generated ${manufacturingOrders.length} manufacturing orders`);

const workOrders = generateWorkOrders(NUM_WORK_ORDERS, workCenters, manufacturingOrders);
console.log(`Generated ${workOrders.length} work orders`);

const output = {
  workOrders,
  workCenters,
  manufacturingOrders
};

const outputPath = join(__dirname, '..', 'sample-data', 'scenario-5-large-scale.json');
writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`\n✅ Generated ${workOrders.length} work orders`);
console.log(`✅ Generated ${workCenters.length} work centers`);
console.log(`✅ Generated ${manufacturingOrders.length} manufacturing orders`);
console.log(`\n📁 Output file: ${outputPath}`);
console.log(`\n📊 Statistics:`);
console.log(`   - Maintenance orders: ${workOrders.filter(wo => wo.data.isMaintenance).length}`);
console.log(`   - Orders with dependencies: ${workOrders.filter(wo => wo.data.dependsOnWorkOrderIds.length > 0).length}`);
console.log(`   - Work centers with maintenance windows: ${workCenters.filter(wc => wc.data.maintenanceWindows.length > 0).length}`);
