# Sample Data Scenarios

This directory contains sample data for testing the Production Schedule Reflow system.

## Scenario 1: Delay Cascade (`scenario-1-delay-cascade.json`)

**Description**: Demonstrates how a delay in one work order cascades to downstream dependent orders.

**Key Features**:
- Work order WO-001 starts first (no dependencies)
- WO-002 depends on WO-001
- WO-003 depends on WO-002 (chain dependency)
- WO-004 depends on WO-002 (multiple orders depending on same parent)
- All work orders on same work center (wc-line1) except WO-004 (wc-line2)

**Expected Behavior**: If WO-001 is delayed, WO-002, WO-003, and WO-004 should all be rescheduled accordingly.

## Scenario 2: Shift & Maintenance (`scenario-2-shift-maintenance.json`)

**Description**: Tests work orders spanning shifts and conflicts with maintenance windows.

**Key Features**:
- WO-101 starts at 3 PM and runs 4 hours (spans across shift boundary at 5 PM)
- WO-102 depends on WO-101
- WO-MAINT-001 is a maintenance work order (cannot be rescheduled)
- WO-104 conflicts with maintenance window on wc-line2 (10 AM - 2 PM)
- Maintenance window blocks time on work center

**Expected Behavior**: 
- WO-101 should pause at 5 PM and resume next day at 8 AM
- WO-104 should be rescheduled to avoid maintenance window
- Maintenance work order should remain fixed

## Scenario 3: Complex (`scenario-3-complex.json`)

**Description**: Complex scenario with multiple dependencies, work center conflicts, and maintenance windows.

**Key Features**:
- Multiple work orders on both work centers
- WO-204 depends on BOTH WO-201 and WO-202 (multiple parents)
- Maintenance window on wc-line1 during lunch (12 PM - 1 PM)
- Multiple dependencies forming a complex graph

**Expected Behavior**: Algorithm should handle multiple parent dependencies, work center conflicts, and maintenance windows simultaneously.

## Scenario 4: Edge Cases (`scenario-4-edge-cases.json`)

**Description**: Comprehensive edge case testing scenario with 20 work orders across 3 work centers, testing multiple constraints simultaneously.

**Key Features**:
- **20 work orders** across 3 work centers (wc-line1, wc-line2, wc-line3)
- **Long dependency chains**: 
  - Chain 1: WO-301 → WO-304 → WO-305 → WO-306 → WO-314 → WO-317
  - Chain 2: WO-302 → WO-307 → WO-308 → WO-309 → WO-315 → WO-318
  - Chain 3: WO-303 → WO-311 → WO-312 → WO-313 → WO-316
- **Multiple parent dependencies**: 
  - WO-310 depends on both WO-301 AND WO-302
  - WO-314 depends on both WO-306 AND WO-310
  - WO-315 depends on both WO-309 AND WO-312
- **Maintenance work orders** (fixed, cannot be rescheduled):
  - WO-MAINT-001 on wc-line1 (12:00-13:30)
  - WO-MAINT-002 on wc-line2 (15:00-16:00)
- **Maintenance windows** (blocked time):
  - wc-line1: 12:00-13:30 (conflicts with WO-304, WO-305)
  - wc-line2: 15:00-16:00 (conflicts with WO-307, WO-308)
  - wc-line2: 13:00-14:00 next day (conflicts with WO-315)
- **Shift boundary crossing**: 
  - WO-306 spans from 16:30 to next day 10:00 (crosses shift boundary at 17:00)
  - WO-308 ends at 17:00 (shift boundary)
  - WO-313 spans from 16:00 to next day 09:30 (crosses shift boundary)
- **Work center conflicts**: Multiple orders scheduled on same work center simultaneously
- **Complex scheduling challenges**:
  - Orders that need to skip maintenance windows
  - Orders that need to wait for multiple parents
  - Orders spanning multiple days
  - Orders starting at exact shift boundaries

**Expected Behavior**: 
- Algorithm must reschedule orders to avoid maintenance windows
- Maintain work center exclusivity (no overlaps)
- Respect all dependency chains
- Handle multiple parent dependencies correctly
- Account for shift boundaries (work pauses/resumes)
- Maintenance orders remain fixed
- Complex cascade effects when one order is delayed

**Testing Focus**:
- Stress testing with many orders
- Multiple constraint types simultaneously
- Long dependency chains
- Complex dependency graphs (multiple parents)
- Maintenance window avoidance
- Shift boundary handling
- Work center conflict resolution
- Algorithm performance with larger datasets

## Usage

1. Copy the JSON content from any scenario file
2. Paste into the JSON input field in the application
3. Click "Run Reflow" to see the rescheduled results

## Date Format

All dates are in ISO 8601 format (UTC):
- Format: `YYYY-MM-DDTHH:mm:ssZ`
- Example: `2024-01-15T08:00:00Z` (January 15, 2024 at 8:00 AM UTC)

## Work Center Shifts

- **Monday-Friday**: 8 AM - 5 PM (17:00)
- Day of week: 1 = Monday, 2 = Tuesday, ..., 5 = Friday
- Sunday = 0, Saturday = 6

## Scenario 5: Large-Scale Test (`scenario-5-large-scale.json`)

**Description**: Large-scale stress test with 1000+ work orders to test algorithm performance and all constraint types simultaneously.

**Key Features**:
- **1,075 work orders** across 18 work centers
- **18 work centers** with various shift schedules
- **150 manufacturing orders**
- **20 maintenance work orders** (fixed, cannot be rescheduled)
- **1,005 orders with dependencies** (complex dependency chains)
- **5 work centers with maintenance windows**
- **Complex dependency chains**: 20 main chains with branching dependencies
- **Multiple parent dependencies**: Orders depending on multiple parents
- **Shift schedules**: Weekday shifts (8 AM - 5 PM) + some weekend shifts
- **Spread timeline**: Orders distributed across multiple days

**Constraints Tested**:
- ✅ **Dependencies**: Complex chains and multiple parent dependencies
- ✅ **Work Center Conflicts**: Many orders competing for same work centers
- ✅ **Shift Boundaries**: Orders spanning across shift boundaries
- ✅ **Maintenance Windows**: Multiple maintenance windows blocking time
- ✅ **Maintenance Orders**: Fixed orders that cannot be rescheduled
- ✅ **Performance**: Stress testing with 1000+ orders

**Expected Behavior**: 
- Algorithm should efficiently process all 1000+ orders
- Respect all constraints simultaneously
- Handle complex dependency graphs
- Reschedule orders while maintaining constraint satisfaction
- Performance should remain acceptable with large dataset

**Testing Focus**:
- Algorithm scalability
- Performance with large datasets
- Complex constraint resolution
- Dependency chain handling at scale
- Visualization performance (Gantt chart, DAG)

**File Size**: ~494 KB (19,450+ lines)

## Scenario 6: Super Large-Scale Test (`scenario-6-super-large.json`)

**Description**: Massive stress test with 10,000+ work orders to test algorithm performance, scalability, and all constraint types at enterprise scale.

**Key Features**:
- **10,000 work orders** across 50 work centers
- **50 work centers** with various shift schedules
- **1,000 manufacturing orders**
- **200 maintenance work orders** (fixed, cannot be rescheduled)
- **9,633 orders with dependencies** (complex dependency chains)
- **20 work centers with maintenance windows**
- **100 main dependency chains** with branching dependencies
- **Multiple parent dependencies**: Orders depending on multiple parents
- **Shift schedules**: Weekday shifts (8 AM - 5 PM) + weekend shifts on some centers
- **Extended timeline**: Orders distributed across multiple weeks

**Constraints Tested**:
- ✅ **Dependencies**: 100 complex chains with branching and multiple parent dependencies
- ✅ **Work Center Conflicts**: Many orders competing for same work centers (50 centers)
- ✅ **Shift Boundaries**: Orders spanning across shift boundaries
- ✅ **Maintenance Windows**: 20 work centers with maintenance windows blocking time
- ✅ **Maintenance Orders**: 200 fixed orders that cannot be rescheduled
- ✅ **Performance**: Extreme stress testing with 10,000 orders
- ✅ **Scalability**: Testing algorithm performance with enterprise-scale data

**Expected Behavior**: 
- Algorithm should efficiently process all 10,000 orders
- Respect all constraints simultaneously at scale
- Handle complex dependency graphs with 100 chains
- Reschedule orders while maintaining constraint satisfaction
- Performance should remain acceptable with massive dataset
- Memory and CPU usage should be reasonable

**Testing Focus**:
- Algorithm scalability and performance
- Memory efficiency with large datasets
- Complex constraint resolution at scale
- Dependency chain handling with 100 chains
- Visualization performance (Gantt chart, DAG) - may require optimization
- Real-world enterprise scenario simulation

**File Size**: ~4.48 MB (180,000+ lines)

⚠️ **Note**: This file is very large (~4.5 MB). Loading and processing may take time. The visualization components (Gantt chart, DAG) may need optimization for this scale.

## Notes

- All work centers operate Monday-Friday, 8 AM - 5 PM
- Work pauses outside shift hours
- Maintenance windows block work on the specified work center
- Maintenance work orders (`isMaintenance: true`) cannot be rescheduled

