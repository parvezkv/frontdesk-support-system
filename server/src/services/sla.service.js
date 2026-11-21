/**
 * SLA Calculation Service for Frontdesk
 *
 * STRICT BUSINESS RULES:
 * - Working Days: Monday to Friday.
 * - Working Hours: 9:30 AM to 6:30 PM (9 working hours / 540 working minutes per day).
 * - Timezone: Asia/Kolkata (UTC +05:30).
 * - Weekends excluded (Saturday and Sunday).
 * - Configured company/festival holidays excluded.
 * - SLA Timers pause when status is WAITING_FOR_CUSTOMER / PENDING_CUSTOMER.
 * - Multiple waiting periods supported.
 * - When customer replies, the clock resumes excluding the paused working period.
 * - When priority changes, deadlines recalculate starting from priority-change time.
 * - Critical resolution: same working day interpreted as 6:30 PM IST (end of applicable working day).
 * - A ticket is NOT marked overdue during weekends, outside working hours, or holidays.
 */

const TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MINUTES = 330; // +05:30 = 330 minutes
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

const WORK_START_MINUTES = 9 * 60 + 30; // 09:30 AM -> 570 minutes from midnight
const WORK_END_MINUTES = 18 * 60 + 30;  // 06:30 PM -> 1110 minutes from midnight
const WORK_DAY_MINUTES = WORK_END_MINUTES - WORK_START_MINUTES; // 540 minutes (9 hours)

/**
 * Priority SLA Configurations (in working minutes)
 * Critical/Urgent: First response: 2 working hours (120 min), Resolution: same working day (end of day).
 * Medium: First response: 4 working hours (240 min), Resolution: 3 working days (1620 min).
 * Small/Low: First response: 8 working hours (480 min), Resolution: 5 working days (2700 min).
 * High: First response: 3 working hours (180 min), Resolution: 1 working day (540 min).
 */
const SLA_TARGETS = {
  CRITICAL: { responseMinutes: 120, resolutionSameDay: true, resolutionDays: 0 },
  URGENT:   { responseMinutes: 120, resolutionSameDay: true, resolutionDays: 0 },
  HIGH:     { responseMinutes: 180, resolutionSameDay: false, resolutionMinutes: 540 },
  MEDIUM:   { responseMinutes: 240, resolutionSameDay: false, resolutionMinutes: 3 * WORK_DAY_MINUTES },
  LOW:      { responseMinutes: 480, resolutionSameDay: false, resolutionMinutes: 5 * WORK_DAY_MINUTES },
  SMALL:    { responseMinutes: 480, resolutionSameDay: false, resolutionMinutes: 5 * WORK_DAY_MINUTES },
};

/**
 * Convert UTC timestamp to IST Date components
 */
function toISTDate(utcDate) {
  const d = new Date(utcDate);
  const istMs = d.getTime() + IST_OFFSET_MS;
  return new Date(istMs); // Use UTC getters on this object for exact IST fields
}

/**
 * Convert IST Date components back to a standard UTC Date
 */
function fromISTComponents(year, month, day, hours, minutes, seconds = 0, ms = 0) {
  const istUtcEpoch = Date.UTC(year, month, day, hours, minutes, seconds, ms);
  return new Date(istUtcEpoch - IST_OFFSET_MS);
}

/**
 * Format IST Date to 'YYYY-MM-DD' key
 */
function toDateKey(istDate) {
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Build a Set of 'YYYY-MM-DD' keys for fast holiday lookup
 */
function buildHolidaySet(holidays = []) {
  const holidaySet = new Set();
  for (const h of holidays) {
    if (!h) continue;
    let d = h.date || h;
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      holidaySet.add(d);
    } else {
      const istD = toISTDate(d);
      holidaySet.add(toDateKey(istD));
    }
  }
  return holidaySet;
}

/**
 * Check if a date in IST is a working day (Mon-Fri and not a holiday)
 */
function isWorkingDay(istDate, holidaySet) {
  const dayOfWeek = istDate.getUTCDay();
  // Exclude Saturday (6) and Sunday (0)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  // Exclude configured festival/company holidays
  const key = toDateKey(istDate);
  if (holidaySet && holidaySet.has(key)) {
    return false;
  }
  return true;
}

/**
 * 1a. Determine whether a timestamp falls strictly within working hours.
 * Monday to Friday, 9:30 AM to 6:30 PM Asia/Kolkata, non-holidays.
 */
function isWorkingTime(timestamp, holidays = []) {
  const istDate = toISTDate(timestamp);
  const holidaySet = buildHolidaySet(holidays);

  if (!isWorkingDay(istDate, holidaySet)) {
    return false;
  }

  const minuteOfDay = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
  // Working hours: [09:30, 18:30)
  return minuteOfDay >= WORK_START_MINUTES && minuteOfDay < WORK_END_MINUTES;
}

/**
 * 1b. Find the next working-time instant.
 * If already within working hours, returns the timestamp.
 * If outside working hours, moves to 9:30 AM of the next available working day.
 */
function getNextWorkingTime(timestamp, holidays = []) {
  let istDate = toISTDate(timestamp);
  const holidaySet = buildHolidaySet(holidays);

  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth();
  const day = istDate.getUTCDate();
  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  const seconds = istDate.getUTCSeconds();
  const ms = istDate.getUTCMilliseconds();

  const minuteOfDay = hours * 60 + minutes;

  // Case 1: Today is a working day
  if (isWorkingDay(istDate, holidaySet)) {
    // Before 9:30 AM -> Snap to 9:30 AM today
    if (minuteOfDay < WORK_START_MINUTES) {
      return fromISTComponents(year, month, day, 9, 30, 0, 0);
    }
    // During working hours -> Return original timestamp
    if (minuteOfDay < WORK_END_MINUTES) {
      return new Date(timestamp);
    }
    // At or after 6:30 PM -> Must advance to tomorrow or next working day
  }

  // Advance day-by-day to find the next working day at 09:30 AM
  let checkMs = Date.UTC(year, month, day, 9, 30, 0, 0);
  while (true) {
    checkMs += 24 * 60 * 60 * 1000; // Next day
    const nextIst = new Date(checkMs);
    if (isWorkingDay(nextIst, holidaySet)) {
      return new Date(checkMs - IST_OFFSET_MS);
    }
  }
}

/**
 * 1c. Calculate the end of the current applicable working day (6:30 PM IST).
 * Documented Interpretation (Rule 7):
 * For Critical resolution, "same working day" means 6:30 PM IST of the applicable working day.
 * If created after hours or on a weekend/holiday, the applicable working day is the next working day.
 */
function calculateEndOfWorkingDay(timestamp, holidays = []) {
  const workingStart = getNextWorkingTime(timestamp, holidays);
  const istDate = toISTDate(workingStart);
  return fromISTComponents(
    istDate.getUTCFullYear(),
    istDate.getUTCMonth(),
    istDate.getUTCDate(),
    18,
    30,
    0,
    0
  );
}

/**
 * 1d. Add working minutes to a timestamp.
 * Skips non-working hours, weekends, and holidays.
 */
function addWorkingMinutes(startTimestamp, minutesToAdd, holidays = []) {
  if (minutesToAdd <= 0) {
    return getNextWorkingTime(startTimestamp, holidays);
  }

  const holidaySet = buildHolidaySet(holidays);
  let current = getNextWorkingTime(startTimestamp, holidays);
  let remainingToAdd = minutesToAdd;

  while (remainingToAdd > 0) {
    const istDate = toISTDate(current);
    const minuteOfDay = istDate.getUTCHours() * 60 + istDate.getUTCMinutes() + istDate.getUTCSeconds() / 60;
    const workingMinutesLeftToday = WORK_END_MINUTES - minuteOfDay;

    if (remainingToAdd <= workingMinutesLeftToday) {
      // Finishes within the current working day
      return new Date(current.getTime() + remainingToAdd * 60 * 1000);
    }

    // Use up today's remaining working hours
    remainingToAdd -= workingMinutesLeftToday;

    // Advance to 9:30 AM of the next working day
    let checkMs = Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate(), 9, 30, 0, 0);
    while (true) {
      checkMs += 24 * 60 * 60 * 1000;
      const nextIst = new Date(checkMs);
      if (isWorkingDay(nextIst, holidaySet)) {
        current = new Date(checkMs - IST_OFFSET_MS);
        break;
      }
    }
  }

  return current;
}

/**
 * 1e. Calculate working minutes between two timestamps.
 * Excludes weekends, holidays, and off-work hours.
 */
function calculateWorkingMinutesBetween(startTime, endTime, holidays = []) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (end <= start) return 0;

  const holidaySet = buildHolidaySet(holidays);
  let current = getNextWorkingTime(start, holidaySet);
  if (current >= end) return 0;

  let totalWorkingMinutes = 0;

  while (current < end) {
    const istDate = toISTDate(current);
    const minuteOfDay = istDate.getUTCHours() * 60 + istDate.getUTCMinutes() + istDate.getUTCSeconds() / 60;
    const workingMinutesLeftToday = WORK_END_MINUTES - minuteOfDay;

    // Calculate end of today's working shift in UTC
    const endOfShiftToday = fromISTComponents(
      istDate.getUTCFullYear(),
      istDate.getUTCMonth(),
      istDate.getUTCDate(),
      18,
      30,
      0,
      0
    );

    if (end <= endOfShiftToday) {
      // Both start and end land within this same working shift
      const endIst = toISTDate(end);
      const endMinuteOfDay = endIst.getUTCHours() * 60 + endIst.getUTCMinutes() + endIst.getUTCSeconds() / 60;
      const effectiveEndMinute = Math.max(WORK_START_MINUTES, Math.min(WORK_END_MINUTES, endMinuteOfDay));
      totalWorkingMinutes += Math.max(0, effectiveEndMinute - minuteOfDay);
      break;
    } else {
      // Add all remaining minutes in this shift
      totalWorkingMinutes += workingMinutesLeftToday;

      // Advance to 9:30 AM of the next working day
      let checkMs = Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate(), 9, 30, 0, 0);
      while (true) {
        checkMs += 24 * 60 * 60 * 1000;
        const nextIst = new Date(checkMs);
        if (isWorkingDay(nextIst, holidaySet)) {
          current = new Date(checkMs - IST_OFFSET_MS);
          break;
        }
      }
    }
  }

  return Math.round(totalWorkingMinutes);
}

/**
 * Calculate standard SLA deadlines for a ticket based on priority and creation time
 */
function calculateSLADeadlines(priority, createdAt = new Date(), holidays = []) {
  const key = String(priority).toUpperCase();
  const config = SLA_TARGETS[key] || SLA_TARGETS.MEDIUM;

  const responseDueAt = addWorkingMinutes(createdAt, config.responseMinutes, holidays);

  let resolutionDueAt;
  if (config.resolutionSameDay) {
    resolutionDueAt = calculateEndOfWorkingDay(createdAt, holidays);
  } else {
    resolutionDueAt = addWorkingMinutes(createdAt, config.resolutionMinutes, holidays);
  }

  return {
    responseDueAt,
    resolutionDueAt,
  };
}

/**
 * Calculate total working minutes paused across multiple waiting periods
 */
function calculateTotalPausedWorkingMinutes(slaPauses = [], holidays = [], currentTime = new Date()) {
  let totalPaused = 0;
  for (const pause of slaPauses) {
    const start = pause.startedAt;
    const end = pause.endedAt || currentTime;
    totalPaused += calculateWorkingMinutesBetween(start, end, holidays);
  }
  return totalPaused;
}

/**
 * Resume SLA clock by adjusting deadlines with paused working minutes
 */
function extendDeadlinesForPause(ticket, pauseDurationWorkingMinutes, holidays = []) {
  if (pauseDurationWorkingMinutes <= 0) {
    return {
      responseDueAt: ticket.responseDueAt,
      resolutionDueAt: ticket.resolutionDueAt,
    };
  }

  let newResponseDueAt = ticket.responseDueAt;
  // If first response has not yet been recorded, push the response deadline forward
  if (ticket.responseDueAt && !ticket.firstResponseAt) {
    newResponseDueAt = addWorkingMinutes(ticket.responseDueAt, pauseDurationWorkingMinutes, holidays);
  }

  let newResolutionDueAt = ticket.resolutionDueAt;
  if (ticket.resolutionDueAt && !ticket.resolvedAt) {
    newResolutionDueAt = addWorkingMinutes(ticket.resolutionDueAt, pauseDurationWorkingMinutes, holidays);
  }

  return {
    responseDueAt: newResponseDueAt,
    resolutionDueAt: newResolutionDueAt,
  };
}

/**
 * Recalculate SLA targets when priority changes (Rule 6)
 * New targets are calculated starting from priority-change time, preserving event history.
 */
function recalculateOnPriorityChange(newPriority, changeTime = new Date(), holidays = []) {
  return calculateSLADeadlines(newPriority, changeTime, holidays);
}

/**
 * Check overdue status (Rule 8: Do not mark overdue outside working hours, on weekends or holidays)
 */
function evaluateOverdueStatus(ticket, holidays = [], currentTime = new Date()) {
  const isCurrentlyWorkingTime = isWorkingTime(currentTime, holidays);

  // If currently outside working hours, weekends, or holidays, ticket cannot be marked overdue
  if (!isCurrentlyWorkingTime) {
    return {
      isOverdue: false,
      responseOverdue: false,
      resolutionOverdue: false,
      status: 'SUPPRESSED_NON_WORKING_TIME',
      reason: 'SLA overdue status is suppressed during non-working hours, weekends, and holidays.',
    };
  }

  // If ticket is resolved or closed, it is not overdue
  if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
    return {
      isOverdue: false,
      responseOverdue: false,
      resolutionOverdue: false,
      status: 'COMPLETED',
    };
  }

  // If ticket is currently paused in waiting for customer, it is not overdue
  if (['WAITING_FOR_CUSTOMER', 'PENDING_CUSTOMER'].includes(ticket.status)) {
    return {
      isOverdue: false,
      responseOverdue: false,
      resolutionOverdue: false,
      status: 'PAUSED',
    };
  }

  const responseOverdue = !ticket.firstResponseAt && ticket.responseDueAt && currentTime > new Date(ticket.responseDueAt);
  const resolutionOverdue = !ticket.resolvedAt && ticket.resolutionDueAt && currentTime > new Date(ticket.resolutionDueAt);

  const isOverdue = responseOverdue || resolutionOverdue;

  return {
    isOverdue,
    responseOverdue,
    resolutionOverdue,
    status: isOverdue ? 'OVERDUE' : 'ON_TRACK',
  };
}

/**
 * Calculate remaining SLA working minutes
 */
function calculateRemainingSLAMinutes(dueAt, holidays = [], currentTime = new Date()) {
  if (!dueAt) return 0;
  const due = new Date(dueAt);
  if (currentTime >= due) return 0;
  return calculateWorkingMinutesBetween(currentTime, due, holidays);
}

module.exports = {
  TIMEZONE,
  WORK_START_MINUTES,
  WORK_END_MINUTES,
  WORK_DAY_MINUTES,
  SLA_TARGETS,
  toISTDate,
  fromISTComponents,
  isWorkingTime,
  isWorkingDay,
  getNextWorkingTime,
  calculateEndOfWorkingDay,
  addWorkingMinutes,
  calculateWorkingMinutesBetween,
  calculateSLADeadlines,
  calculateTotalPausedWorkingMinutes,
  extendDeadlinesForPause,
  recalculateOnPriorityChange,
  evaluateOverdueStatus,
  calculateRemainingSLAMinutes,
};
