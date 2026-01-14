# How to Test Shift-Aware Duration Calculation

## Quick Test Method

### Step 1: Use the Test Scenario

I've created a test file: `sample-data/test-shift-calculation.json`

This scenario tests:
- **Work order**: 120 minutes (2 hours) of work
- **Starts**: Monday 4:00 PM (16:00 UTC) = 4:00 PM local time
- **Shift**: Monday-Friday, 8:00 AM - 5:00 PM
- **Expected**: Should work 60 min Mon (4 PM → 5 PM), pause, resume Tue 8 AM, complete Tue 9 AM

### Step 2: Test in the App

1. **Open the app** in your browser (http://localhost:5173)
2. **Copy the JSON** from `sample-data/test-shift-calculation.json`
3. **Paste it** into the JSON input field
4. **Click "Run Reflow"**
5. **Check the results**

### Step 3: Verify the Results

**What to look for:**

1. **Check the "Updated Work Orders" output:**
   - Find `WO-TEST-001`
   - Check the `endDate` field
   - **Expected**: Should be **Tuesday 9:00 AM** (not Monday 6:00 PM)

2. **Check the "Changes" section:**
   - Should show the work order was rescheduled
   - Should mention "shift boundary crossing" in the reason

3. **Check the Gantt Chart:**
   - The work order bar should span from Monday 4 PM to Tuesday 9 AM
   - You should see it pause at Monday 5 PM and resume Tuesday 8 AM

## Expected Results

### Input:
- Start: `2024-01-15T16:00:00Z` (Monday 4:00 PM)
- Duration: 120 minutes
- Shift: Mon-Fri 8 AM - 5 PM

### Expected Output:
- **New Start**: `2024-01-15T16:00:00Z` (Monday 4:00 PM) - same
- **New End**: `2024-01-16T09:00:00Z` (Tuesday 9:00 AM) - **NOT** Monday 6:00 PM!

### Why:
- Works 60 minutes Monday (4 PM → 5 PM)
- Pauses at shift end (5 PM)
- Resumes Tuesday 8 AM
- Works remaining 60 minutes (8 AM → 9 AM)
- **Total working time**: 120 minutes ✅
- **Elapsed time**: ~17 hours (4 PM Mon → 9 AM Tue)

## More Test Cases

### Test Case 2: Work Starting Outside Shift

```json
{
  "workOrders": [
    {
      "docId": "wo-test-002",
      "docType": "workOrder",
      "data": {
        "workOrderNumber": "WO-TEST-002",
        "manufacturingOrderId": "mo-test-002",
        "workCenterId": "wc-line1",
        "startDate": "2024-01-15T19:00:00Z",
        "endDate": "2024-01-15T21:00:00Z",
        "durationMinutes": 60,
        "isMaintenance": false,
        "dependsOnWorkOrderIds": []
      }
    }
  ],
  "workCenters": [
    {
      "docId": "wc-line1",
      "docType": "workCenter",
      "data": {
        "name": "Test Line 1",
        "shifts": [
          { "dayOfWeek": 1, "startHour": 8, "endHour": 17 },
          { "dayOfWeek": 2, "startHour": 8, "endHour": 17 }
        ],
        "maintenanceWindows": []
      }
    }
  ],
  "manufacturingOrders": [
    {
      "docId": "mo-test-002",
      "docType": "manufacturingOrder",
      "data": {
        "manufacturingOrderNumber": "MO-TEST-002",
        "itemId": "ITEM-002",
        "quantity": 100,
        "dueDate": "2024-01-20T00:00:00Z"
      }
    }
  ]
}
```

**Expected:**
- Start: Monday 7:00 PM (outside shift)
- Should start at: **Tuesday 8:00 AM** (next shift)
- End: **Tuesday 9:00 AM** (60 minutes later)

### Test Case 3: Work with Maintenance Window

```json
{
  "workOrders": [
    {
      "docId": "wo-test-003",
      "docType": "workOrder",
      "data": {
        "workOrderNumber": "WO-TEST-003",
        "manufacturingOrderId": "mo-test-003",
        "workCenterId": "wc-line1",
        "startDate": "2024-01-15T10:00:00Z",
        "endDate": "2024-01-15T14:00:00Z",
        "durationMinutes": 240,
        "isMaintenance": false,
        "dependsOnWorkOrderIds": []
      }
    }
  ],
  "workCenters": [
    {
      "docId": "wc-line1",
      "docType": "workCenter",
      "data": {
        "name": "Test Line 1",
        "shifts": [
          { "dayOfWeek": 1, "startHour": 8, "endHour": 17 }
        ],
        "maintenanceWindows": [
          {
            "startDate": "2024-01-15T12:00:00Z",
            "endDate": "2024-01-15T13:00:00Z",
            "reason": "Lunch break"
          }
        ]
      }
    }
  ],
  "manufacturingOrders": [
    {
      "docId": "mo-test-003",
      "docType": "manufacturingOrder",
      "data": {
        "manufacturingOrderNumber": "MO-TEST-003",
        "itemId": "ITEM-003",
        "quantity": 100,
        "dueDate": "2024-01-20T00:00:00Z"
      }
    }
  ]
}
```

**Expected:**
- Start: Monday 10:00 AM
- Works 120 minutes (10 AM → 12 PM)
- **Skips maintenance window** (12 PM → 1 PM)
- Resumes 1:00 PM
- Works remaining 120 minutes (1 PM → 3 PM)
- End: **Monday 3:00 PM** (not 2:00 PM, because 1 hour was skipped for maintenance)

## Manual Verification Checklist

✅ **Work pauses at shift boundaries**
- Work starting near shift end should continue next day

✅ **Work resumes at next shift start**
- Work paused at shift end should resume at next shift start time

✅ **Maintenance windows are skipped**
- Work should pause during maintenance and resume after

✅ **Work starting outside shifts waits for next shift**
- Work scheduled outside shift hours should start at next shift

✅ **End dates are correct**
- End date = start date + working minutes (accounting for pauses)

## Debugging Tips

If the results don't match expectations:

1. **Check the browser console** for any errors
2. **Look at the "Changes" section** - it should explain why times changed
3. **Check the Gantt chart** - visually verify the timeline
4. **Compare original vs new dates** in the output JSON

## Example: What Success Looks Like

**Input:**
```json
{
  "startDate": "2024-01-15T16:00:00Z",  // Monday 4 PM
  "durationMinutes": 120
}
```

**Output (Success):**
```json
{
  "startDate": "2024-01-15T16:00:00Z",  // Monday 4 PM (same)
  "endDate": "2024-01-16T09:00:00Z"    // Tuesday 9 AM ✅
}
```

**Output (Failure - if not working):**
```json
{
  "startDate": "2024-01-15T16:00:00Z",  // Monday 4 PM
  "endDate": "2024-01-15T18:00:00Z"     // Monday 6 PM ❌ (wrong!)
}
```

The key difference: **End date should be Tuesday 9 AM, not Monday 6 PM!**
