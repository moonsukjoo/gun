
import { differenceInMinutes, parseISO, isSameDay } from 'date-fns';

export interface AttendanceStats {
  workHours: number;
  overtimeHours: number;
}

/**
 * Calculates work hours and overtime based on:
 * - Regular work: 08:00 - 17:00 (Max 8h)
 * - Lunch: 12:00 - 13:00 (excluded)
 * - OT Multiplier: 1.5x for time after 17:00
 */
export function calculateAttendanceHours(clockIn: string | Date, clockOut: string | Date): AttendanceStats {
  const inDate = typeof clockIn === 'string' ? parseISO(clockIn) : clockIn;
  const outDate = typeof clockOut === 'string' ? parseISO(clockOut) : clockOut;

  // Ensure dates are valid and in order
  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime()) || outDate < inDate) {
    return { workHours: 0, overtimeHours: 0 };
  }

  // Helper to create a date on the same day as clock-in with specific time
  const getDayTime = (date: Date, hours: number, minutes: number = 0) => {
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const coreStart = getDayTime(inDate, 8, 0);
  const coreEnd = getDayTime(inDate, 17, 0);
  const lunchStart = getDayTime(inDate, 12, 0);
  const lunchEnd = getDayTime(inDate, 13, 0);

  // 1. Regular Hours Calculation
  // We only count time between 08:00 and 17:00
  const regOverlapStart = new Date(Math.max(inDate.getTime(), coreStart.getTime()));
  const regOverlapEnd = new Date(Math.min(outDate.getTime(), coreEnd.getTime()));
  
  let regularMinutes = 0;
  if (regOverlapStart < regOverlapEnd) {
    const totalRegMinutes = differenceInMinutes(regOverlapEnd, regOverlapStart);
    
    // Lunch overlap within the regular period (12:00-13:00)
    const lunchOverlapStart = new Date(Math.max(regOverlapStart.getTime(), lunchStart.getTime()));
    const lunchOverlapEnd = new Date(Math.min(regOverlapEnd.getTime(), lunchEnd.getTime()));
    
    let lunchMinutes = 0;
    if (lunchOverlapStart < lunchOverlapEnd) {
      lunchMinutes = differenceInMinutes(lunchOverlapEnd, lunchOverlapStart);
    }
    
    regularMinutes = totalRegMinutes - lunchMinutes;
  }
  
  const workHours = Math.floor(Math.max(0, regularMinutes / 60));

  // 2. Overtime Hours Calculation (Time after 17:00)
  let overtimeMinutes = 0;
  if (outDate > coreEnd) {
    // If clocked in before 17:00, OT starts at 17:00. If clocked in after 17:00, OT starts at clock-in.
    const otStart = new Date(Math.max(inDate.getTime(), coreStart.getTime(), coreEnd.getTime()));
    overtimeMinutes = Math.max(0, differenceInMinutes(outDate, otStart));
  }
  
  // Return strictly in 1-hour units as requested (no decimals like 0.1 or 0.5)
  const overtimeHours = Math.floor(overtimeMinutes / 60);

  return {
    workHours,
    overtimeHours
  };
}
