/**
 * Date utility functions using Luxon
 */

import { DateTime } from "luxon";

/**
 * Parse ISO date string to DateTime
 */
export function parseDate(dateString: string): DateTime {
  return DateTime.fromISO(dateString, { zone: "utc" });
}

/**
 * Format DateTime to ISO string
 */
export function formatDate(date: DateTime): string {
  return date.toISO() || "";
}

/**
 * Check if a date falls within shift hours
 */
export function isWithinShift(
  date: DateTime,
  shifts: Array<{ dayOfWeek: number; startHour: number; endHour: number }>
): boolean {
  const dayOfWeek = date.weekday === 7 ? 0 : date.weekday; // Convert Sunday (7) to 0
  const hour = date.hour;

  return shifts.some((shift) => {
    if (shift.dayOfWeek !== dayOfWeek) return false;
    return hour >= shift.startHour && hour < shift.endHour;
  });
}

/**
 * Check if a date falls within a maintenance window
 */
export function isInMaintenanceWindow(
  date: DateTime,
  maintenanceWindows: Array<{ startDate: string; endDate: string }>
): boolean {
  return maintenanceWindows.some((window) => {
    const start = parseDate(window.startDate);
    const end = parseDate(window.endDate);
    return date >= start && date < end;
  });
}

/**
 * Get the next shift start time after a given date
 */
export function getNextShiftStart(
  date: DateTime,
  shifts: Array<{ dayOfWeek: number; startHour: number; endHour: number }>
): DateTime | null {
  // Find the next available shift
  for (let i = 0; i < 7; i++) {
    const checkDate = date.plus({ days: i });
    const dayOfWeek = checkDate.weekday === 7 ? 0 : checkDate.weekday;
    
    const shift = shifts.find((s) => s.dayOfWeek === dayOfWeek);
    if (shift) {
      const shiftStart = checkDate.set({ hour: shift.startHour, minute: 0, second: 0, millisecond: 0 });
      if (shiftStart > date) {
        return shiftStart;
      }
    }
  }
  return null;
}

/**
 * Get the current shift for a given date, or null if not in a shift
 */
export function getCurrentShift(
  date: DateTime,
  shifts: Array<{ dayOfWeek: number; startHour: number; endHour: number }>
): { dayOfWeek: number; startHour: number; endHour: number } | null {
  const dayOfWeek = date.weekday === 7 ? 0 : date.weekday;
  const hour = date.hour;
  
  return shifts.find((shift) => {
    if (shift.dayOfWeek !== dayOfWeek) return false;
    return hour >= shift.startHour && hour < shift.endHour;
  }) || null;
}

/**
 * Calculate minutes until the current shift ends
 * Returns 0 if not in a shift, or minutes until shift end if in a shift
 */
export function getMinutesUntilShiftEnd(
  date: DateTime,
  shifts: Array<{ dayOfWeek: number; startHour: number; endHour: number }>
): number {
  const currentShift = getCurrentShift(date, shifts);
  if (!currentShift) {
    return 0;
  }
  
  // Calculate shift end time on the same day
  let shiftEnd = date.set({ 
    hour: currentShift.endHour, 
    minute: 0, 
    second: 0, 
    millisecond: 0 
  });
  
  // If the shift end is before current time (shouldn't happen if we're in shift, but handle edge case)
  if (shiftEnd <= date) {
    return 0;
  }
  
  const diff = shiftEnd.diff(date, 'minutes').minutes;
  return Math.max(0, Math.floor(diff));
}

/**
 * Get minutes until the next maintenance window starts, or null if none upcoming
 */
export function getMinutesUntilMaintenanceWindow(
  date: DateTime,
  maintenanceWindows: Array<{ startDate: string; endDate: string }>
): number | null {
  let minMinutes: number | null = null;
  
  for (const window of maintenanceWindows) {
    const windowStart = parseDate(window.startDate);
    
    // Only consider future maintenance windows
    if (windowStart > date) {
      const diff = windowStart.diff(date, 'minutes').minutes;
      if (minMinutes === null || diff < minMinutes) {
        minMinutes = Math.floor(diff);
      }
    }
  }
  
  return minMinutes;
}

/**
 * Find the current maintenance window that contains the given date, or null
 */
export function findCurrentMaintenanceWindow(
  date: DateTime,
  maintenanceWindows: Array<{ startDate: string; endDate: string }>
): { startDate: string; endDate: string } | null {
  return maintenanceWindows.find((window) => {
    const start = parseDate(window.startDate);
    const end = parseDate(window.endDate);
    return date >= start && date < end;
  }) || null;
}

/**
 * Get the next available time for work (after shift start, not in maintenance)
 */
export function getNextAvailableTime(
  date: DateTime,
  shifts: Array<{ dayOfWeek: number; startHour: number; endHour: number }>,
  maintenanceWindows: Array<{ startDate: string; endDate: string }>
): DateTime {
  // If we're in a shift and not in maintenance, return current time
  if (isWithinShift(date, shifts) && !isInMaintenanceWindow(date, maintenanceWindows)) {
    return date;
  }
  
  // If we're in a maintenance window, jump past it
  const currentWindow = findCurrentMaintenanceWindow(date, maintenanceWindows);
  if (currentWindow) {
    const windowEnd = parseDate(currentWindow.endDate);
    // Check if we're still in a shift after the maintenance window
    if (isWithinShift(windowEnd, shifts)) {
      return windowEnd;
    }
    // Otherwise, find next shift after maintenance window
    const nextShift = getNextShiftStart(windowEnd, shifts);
    return nextShift || windowEnd;
  }
  
  // If we're outside shift hours, find next shift
  if (!isWithinShift(date, shifts)) {
    const nextShift = getNextShiftStart(date, shifts);
    if (nextShift) {
      // Check if next shift start is in a maintenance window
      if (isInMaintenanceWindow(nextShift, maintenanceWindows)) {
        const window = findCurrentMaintenanceWindow(nextShift, maintenanceWindows);
        if (window) {
          return parseDate(window.endDate);
        }
      }
      return nextShift;
    }
  }
  
  // Fallback: just advance by 1 hour (shouldn't reach here in normal cases)
  return date.plus({ hours: 1 });
}

/**
 * Calculate total available work time between start and end date
 * Accounts for shifts and maintenance windows
 */
export function calculateAvailableWorkTime(
  startDate: DateTime,
  endDate: DateTime,
  shifts: Array<{ dayOfWeek: number; startHour: number; endHour: number }>,
  maintenanceWindows: Array<{ startDate: string; endDate: string }>
): number {
  let totalMinutes = 0;
  let currentDate = startDate;

  while (currentDate < endDate) {
    // Check if current time is within a shift
    if (isWithinShift(currentDate, shifts)) {
      // Check if in maintenance window
      if (!isInMaintenanceWindow(currentDate, maintenanceWindows)) {
        // Calculate minutes until next blocking event
        const minutesUntilShiftEnd = getMinutesUntilShiftEnd(currentDate, shifts);
        const minutesUntilMaintenance = getMinutesUntilMaintenanceWindow(
          currentDate,
          maintenanceWindows
        );

        // Calculate available minutes in this segment
        let availableMinutes = minutesUntilShiftEnd;
        if (minutesUntilMaintenance !== null && minutesUntilMaintenance > 0) {
          availableMinutes = Math.min(availableMinutes, minutesUntilMaintenance);
        }

        // Cap at remaining time until endDate
        const remainingUntilEnd = endDate.diff(currentDate, 'minutes').minutes;
        availableMinutes = Math.min(availableMinutes, Math.floor(remainingUntilEnd));

        if (availableMinutes > 0) {
          totalMinutes += availableMinutes;
          currentDate = currentDate.plus({ minutes: availableMinutes });
          continue;
        }
      }
    }

    // Move to next available time
    const nextAvailable = getNextAvailableTime(
      currentDate.plus({ minutes: 1 }),
      shifts,
      maintenanceWindows
    );
    
    if (nextAvailable > endDate) {
      break;
    }
    
    currentDate = nextAvailable;
  }

  return totalMinutes;
}
