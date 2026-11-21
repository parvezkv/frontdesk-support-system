/**
 * Date and Time Utility
 * Timestamps are stored consistently in UTC in the database.
 * Formatted dates are displayed in 'Asia/Kolkata' timezone (IST).
 */

const TIMEZONE = 'Asia/Kolkata';

/**
 * Format a Date object or ISO string to an Asia/Kolkata readable string.
 * Output format: "21 Nov 2026, 07:30 PM IST"
 */
function formatToIST(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return `${formatter.format(d)} IST`;
}

/**
 * Attach formatted IST display strings to any object containing UTC date fields.
 */
function withISTDisplay(obj, dateFields = ['createdAt', 'updatedAt', 'resolvedAt', 'closedAt', 'firstResponseAt', 'responseDueAt', 'resolutionDueAt', 'assignedAt', 'releasedAt', 'startedAt', 'endedAt']) {
  if (!obj) return obj;
  const clone = { ...obj };
  for (const field of dateFields) {
    if (clone[field]) {
      clone[`${field}IST`] = formatToIST(clone[field]);
    }
  }
  return clone;
}

module.exports = {
  TIMEZONE,
  formatToIST,
  withISTDisplay,
};
