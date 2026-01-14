/**
 * Script to generate a super large-scale sample data file with 10,000+ work orders
 * Tests all constraints: dependencies, work centers, shifts, maintenance windows
 */

import { writeFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const NUM_WORK_ORDERS = 10000;
const NUM_WORK_CENTERS = 50;
const NUM_MANUFACTURING_ORDERS = 1000;
const BASE_DATE = '2024-01-15T08:00:00Z';

// Generate work centers
function generateWorkCenters(count) {
  const centers = [];
  const baseNames = [
    'Extrusion Line', 'Assembly Line', 'Packaging Line',
    'Quality Control', 'Coating Station', 'Machining Center',
    'Welding Station', 'Cutting Station', 'Finishing Station',
    'Inspection Line', 'Testing Station', 'Material Prep'
  ];

  for (let i = 0; i < count; i++) {
    const baseName = baseNames[i % baseNames.length];
    const suffix = Math.floor(i / baseNames.length) + 1;
    const name = `${baseName} ${suffix}`;
    const wcId = `wc-${i + 1}`;
    
    // Standard weekday shifts (8 AM - 5 PM)
    const shifts = [1, 2, 3, 4, 5].map(day => ({
      dayOfWeek: day,
      startHour: 8,
      endHour: 17
    }));

    // First 15 centers have weekend shifts
    if (i < 15) {
      shifts.push(
        { dayOfWeek: 6, startHour: 8, endHour: 14 } // Saturday half day
      );
    }

    // Maintenance windows - distributed across work centers
    const maintenanceWindows = [];
    if (i < 20) {
      // First 20 centers have maintenance windows
      const baseDate = new Date(BASE_DATE);
      baseDate.setDate(baseDate.getDate() + Math.floor(i / 3));
      const maintStart = new Date(baseDate);
      maintStart.setHours(12 + (i % 2), 0, 0, 0);
      const maintEnd = new Date(maintStart);
      maintEnd.setHours(maintStart.getHours() + 1, 30, 0, 0);
      
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
    dueDate.setDate(dueDate.getDate() + 7 + (i % 30)); // Spread over 30 days
    
    orders.push({
      docId: `mo-${String(i + 1).padStart(5, '0')}`,
      docType: 'manufacturingOrder',
      data: {
        manufacturingOrderNumber: `MO-${String(i + 1).padStart(5, '0')}`,
        itemId: `ITEM-${String((i % 200) + 1).padStart(4, '0')}`,
        quantity: 100 + (i % 1000) * 10,
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
  
  // Create 100 root chains (groups of dependent orders)
  const chainSizes = [];
  let remaining = count - 200; // Reserve 200 for independent/maintenance orders
  
  for (let i = 0; i < 100; i++) {
    const chainSize = Math.min(80 + Math.floor(Math.random() * 40), remaining);
    chainSizes.push(chainSize);
    remaining -= chainSize;
    if (remaining <= 0) break;
  }
  
  let woIndex = 0;

  // Generate maintenance orders (fixed, non-movable) - 200 total
  for (let i = 0; i < 200; i++) {
    const wcIndex = i % workCenters.length;
    const workCenter = workCenters[wcIndex];
    const startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() + Math.floor(i / 10));
    startDate.setHours(10 + (i % 8), (i * 7) % 60, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 2, 30, 0);

    orders.push({
      docId: `wo-maint-${String(i + 1).padStart(4, '0')}`,
      docType: 'workOrder',
      data: {
        workOrderNumber: `WO-MAINT-${String(i + 1).padStart(4, '0')}`,
        manufacturingOrderId: `mo-maint-${String(i + 1).padStart(4, '0')}`,
        workCenterId: workCenter.docId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        durationMinutes: 150,
        isMaintenance: true,
        dependsOnWorkOrderIds: []
      }
    });
  }

  woIndex = 200;

  // Generate dependency chains
  chainSizes.forEach((chainSize, chainIndex) => {
    const chainStartWoIndex = woIndex;
    
    for (let i = 0; i < chainSize; i++) {
      const wcIndex = (chainIndex * 7 + i * 3) % workCenters.length;
      const workCenter = workCenters[wcIndex];
      const moIndex = (woIndex * 3) % manufacturingOrders.length;
      const manufacturingOrder = manufacturingOrders[moIndex];
      
      const startDate = new Date(baseDate);
      startDate.setDate(startDate.getDate() + Math.floor(woIndex / 200));
      startDate.setHours(8 + (woIndex % 9), (woIndex * 7) % 60, 0, 0);
      
      const durationMinutes = 60 + (woIndex % 300); // 1-5 hours
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + durationMinutes);

      const dependsOn = [];
      if (i > 0) {
        // Each order depends on previous in chain
        dependsOn.push(`wo-${String(chainStartWoIndex + i - 1).padStart(5, '0')}`);
      }
      
      // Some orders have multiple dependencies (branching)
      if (i > 3 && i % 7 === 0) {
        const prevChainWoIndex = chainStartWoIndex + i - 4;
        if (prevChainWoIndex >= 200) {
          dependsOn.push(`wo-${String(prevChainWoIndex).padStart(5, '0')}`);
        }
      }
      
      // Some chains branch - orders depend on multiple previous orders
      if (i > 5 && i % 10 === 0 && chainSize > 10) {
        const branchIndex = chainStartWoIndex + Math.floor(i / 2);
        if (branchIndex >= 200 && branchIndex < chainStartWoIndex + i) {
          dependsOn.push(`wo-${String(branchIndex).padStart(5, '0')}`);
        }
      }

      const woId = `wo-${String(woIndex).padStart(5, '0')}`;

      orders.push({
        docId: woId,
        docType: 'workOrder',
        data: {
          workOrderNumber: `WO-${String(woIndex).padStart(5, '0')}`,
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
  });

  // Generate independent work orders (no dependencies) - fill remaining
  const remainingCount = count - woIndex;
  for (let i = 0; i < Math.min(remainingCount, 200); i++) {
    const wcIndex = woIndex % workCenters.length;
    const workCenter = workCenters[wcIndex];
    const moIndex = woIndex % manufacturingOrders.length;
    const manufacturingOrder = manufacturingOrders[moIndex];
    
    const startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() + Math.floor(woIndex / 300));
    startDate.setHours(8 + (woIndex % 9), (woIndex * 11) % 60, 0, 0);
    
    const durationMinutes = 90 + (woIndex % 240);
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + durationMinutes);

    orders.push({
      docId: `wo-${String(woIndex).padStart(5, '0')}`,
      docType: 'workOrder',
      data: {
        workOrderNumber: `WO-${String(woIndex).padStart(5, '0')}`,
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
console.log('Generating super large-scale sample data (10,000+ work orders)...');
console.log('This may take a few moments...\n');

const workCenters = generateWorkCenters(NUM_WORK_CENTERS);
console.log(`✅ Generated ${workCenters.length} work centers`);

const manufacturingOrders = generateManufacturingOrders(NUM_MANUFACTURING_ORDERS);
console.log(`✅ Generated ${manufacturingOrders.length} manufacturing orders`);

const workOrders = generateWorkOrders(NUM_WORK_ORDERS, workCenters, manufacturingOrders);
console.log(`✅ Generated ${workOrders.length} work orders`);

const output = {
  workOrders,
  workCenters,
  manufacturingOrders
};

const outputPath = join(__dirname, '..', 'sample-data', 'scenario-6-super-large.json');
console.log(`\n📝 Writing to file: ${outputPath}`);
writeFileSync(outputPath, JSON.stringify(output, null, 2));

const fileSizeMB = statSync(outputPath).size / (1024 * 1024);

console.log(`\n✅ Successfully generated super large-scale sample data!`);
console.log(`\n📊 Statistics:`);
console.log(`   - Work orders: ${workOrders.length}`);
console.log(`   - Work centers: ${workCenters.length}`);
console.log(`   - Manufacturing orders: ${manufacturingOrders.length}`);
console.log(`   - Maintenance orders: ${workOrders.filter(wo => wo.data.isMaintenance).length}`);
console.log(`   - Orders with dependencies: ${workOrders.filter(wo => wo.data.dependsOnWorkOrderIds.length > 0).length}`);
console.log(`   - Work centers with maintenance windows: ${workCenters.filter(wc => wc.data.maintenanceWindows.length > 0).length}`);
console.log(`   - File size: ${fileSizeMB.toFixed(2)} MB`);
console.log(`\n📁 Output file: ${outputPath}`);
