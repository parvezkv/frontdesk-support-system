/**
 * SLA Calculation Service Automated Test Suite
 * Validates all strict business rules and edge cases from the machine test:
 * - Working hours: Mon-Fri 09:30 - 18:30 Asia/Kolkata
 * - Weekends and configured holidays excluded
 * - Critical / Urgent (2h response, same day resolution)
 * - Medium (4h response, 3 days resolution)
 * - Small (8h response, 5 days resolution)
 * - Pause / resume with customer response
 * - Multiple waiting periods
 * - Priority change recalculation (Small -> Critical)
 * - Weekend crossing
 * - Overdue status suppression outside working hours
 */

const {
  TIMEZONE,
  fromISTComponents,
  toISTDate,
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
} = require('./src/services/sla.service');
const { formatToIST } = require('./src/utils/date');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failed++;
  }
}

// Configured test holiday: Friday, Nov 27, 2026
const testHolidays = [
  { date: '2026-11-27', name: 'Festival Holiday (Friday)' },
  { date: '2026-01-26', name: 'Republic Day' },
];

console.log('🧪 Starting SLA Engine Unit & Edge Case Test Suite...\n');

// -----------------------------------------------------------------------------
// TEST CASE 1: Working hours validation & Timezone
// -----------------------------------------------------------------------------
console.log('1. Testing Working Hours Boundary Checks (Asia/Kolkata):');
// Monday Nov 23, 2026
const mon929 = fromISTComponents(2026, 10, 23, 9, 29, 59); // 09:29:59 AM
const mon930 = fromISTComponents(2026, 10, 23, 9, 30, 0);  // 09:30:00 AM
const mon1400 = fromISTComponents(2026, 10, 23, 14, 0, 0); // 02:00:00 PM
const mon1829 = fromISTComponents(2026, 10, 23, 18, 29, 59); // 06:29:59 PM
const mon1830 = fromISTComponents(2026, 10, 23, 18, 30, 0);  // 06:30:00 PM
const sat1100 = fromISTComponents(2026, 10, 28, 11, 0, 0); // Saturday 11:00 AM
const hol1100 = fromISTComponents(2026, 10, 27, 11, 0, 0); // Holiday Friday 11:00 AM

assert(!isWorkingTime(mon929, testHolidays), 'Mon 09:29:59 AM is outside working hours (starts 09:30 AM)');
assert(isWorkingTime(mon930, testHolidays), 'Mon 09:30:00 AM is inside working hours');
assert(isWorkingTime(mon1400, testHolidays), 'Mon 02:00:00 PM is inside working hours');
assert(isWorkingTime(mon1829, testHolidays), 'Mon 06:29:59 PM is inside working hours');
assert(!isWorkingTime(mon1830, testHolidays), 'Mon 06:30:00 PM is outside working hours (shift ends)');
assert(!isWorkingTime(sat1100, testHolidays), 'Saturday 11:00 AM is outside working hours (weekend excluded)');
assert(!isWorkingTime(hol1100, testHolidays), 'Configured holiday (Nov 27) 11:00 AM is outside working hours (holiday excluded)');

// -----------------------------------------------------------------------------
// TEST CASE 2: Ticket created at 10:00 AM Monday
// -----------------------------------------------------------------------------
console.log('\n2. Testing Ticket Created at 10:00 AM Monday:');
const mon10am = fromISTComponents(2026, 10, 23, 10, 0, 0);

// Critical: 2h response, same day resolution
const slaMonCritical = calculateSLADeadlines('CRITICAL', mon10am, testHolidays);
assert(
  formatToIST(slaMonCritical.responseDueAt) === '23 Nov 2026, 12:00:00 pm IST',
  `Critical response due at 12:00 PM Monday (got ${formatToIST(slaMonCritical.responseDueAt)})`
);
assert(
  formatToIST(slaMonCritical.resolutionDueAt) === '23 Nov 2026, 06:30:00 pm IST',
  `Critical resolution due at 06:30 PM same working day (got ${formatToIST(slaMonCritical.resolutionDueAt)})`
);

// Medium: 4h response, 3 working days resolution
const slaMonMedium = calculateSLADeadlines('MEDIUM', mon10am, testHolidays);
assert(
  formatToIST(slaMonMedium.responseDueAt) === '23 Nov 2026, 02:00:00 pm IST',
  `Medium response due at 02:00 PM Monday (got ${formatToIST(slaMonMedium.responseDueAt)})`
);
// 3 working days = 3 * 540 min = Thursday 10:00 AM
assert(
  formatToIST(slaMonMedium.resolutionDueAt) === '26 Nov 2026, 10:00:00 am IST',
  `Medium resolution due after 3 working days: Thursday 10:00 AM (got ${formatToIST(slaMonMedium.resolutionDueAt)})`
);

// Small: 8h response (1 working day), 5 working days resolution (Nov 27 is holiday!)
const slaMonSmall = calculateSLADeadlines('SMALL', mon10am, testHolidays);
// 8h on Monday: 10:00 to 18:30 is 8.5h. 8h lands at 6:00 PM Monday
assert(
  formatToIST(slaMonSmall.responseDueAt) === '23 Nov 2026, 06:00:00 pm IST',
  `Small response due at 06:00 PM Monday (got ${formatToIST(slaMonSmall.responseDueAt)})`
);
// 5 working days: Mon -> Tue -> Wed -> Thu -> [Fri holiday skipped] -> [Sat/Sun skipped] -> Mon Nov 30 (Day 4) -> Tue Dec 01 10:00 AM (Day 5)!
assert(
  formatToIST(slaMonSmall.resolutionDueAt) === '01 Dec 2026, 10:00:00 am IST',
  `Small resolution crosses holiday and weekend -> lands on Tuesday Dec 01 10:00 AM (got ${formatToIST(slaMonSmall.resolutionDueAt)})`
);

// -----------------------------------------------------------------------------
// TEST CASE 3: Ticket created at 6:00 PM Friday (Crossing a Weekend)
// -----------------------------------------------------------------------------
console.log('\n3. Testing Ticket Created at 6:00 PM Friday (Crossing Weekend):');
// Friday Nov 20, 2026 at 18:00 (30 min before shift ends)
const fri6pm = fromISTComponents(2026, 10, 20, 18, 0, 0);

// Critical: 2 working hours
// Friday has 30 mins left (18:00 to 18:30).
// Remaining 90 mins roll over across weekend (Sat & Sun skipped) to Monday 09:30 AM + 90 min = Monday 11:00 AM!
const slaFriCritical = calculateSLADeadlines('CRITICAL', fri6pm, testHolidays);
assert(
  formatToIST(slaFriCritical.responseDueAt) === '23 Nov 2026, 11:00:00 am IST',
  `Critical response crosses weekend -> due Monday 11:00 AM IST (got ${formatToIST(slaFriCritical.responseDueAt)})`
);
assert(
  formatToIST(slaFriCritical.resolutionDueAt) === '20 Nov 2026, 06:30:00 pm IST',
  `Critical resolution due same day: Friday 06:30 PM IST (got ${formatToIST(slaFriCritical.resolutionDueAt)})`
);

// Medium: 4 working hours (240 min)
// 30 min on Fri + 210 min on Mon (09:30 + 3.5h = 1:00 PM Mon)
const slaFriMedium = calculateSLADeadlines('MEDIUM', fri6pm, testHolidays);
assert(
  formatToIST(slaFriMedium.responseDueAt) === '23 Nov 2026, 01:00:00 pm IST',
  `Medium response crosses weekend -> due Monday 01:00 PM IST (got ${formatToIST(slaFriMedium.responseDueAt)})`
);

// -----------------------------------------------------------------------------
// TEST CASE 4: Ticket created outside working hours
// -----------------------------------------------------------------------------
console.log('\n4. Testing Ticket Created Outside Working Hours:');
// Tuesday 8:00 PM IST (after shift ends) -> next working time is Wednesday 09:30 AM
const tue8pm = fromISTComponents(2026, 10, 24, 20, 0, 0);
const nextWorkingTimeTue = getNextWorkingTime(tue8pm, testHolidays);
assert(
  formatToIST(nextWorkingTimeTue) === '25 Nov 2026, 09:30:00 am IST',
  `After-hours timestamp snaps to Wednesday 09:30 AM IST (got ${formatToIST(nextWorkingTimeTue)})`
);

// Critical target from after-hours starts from Wednesday 09:30 AM:
// Response (2h): Wednesday 11:30 AM
// Resolution (same working day): Wednesday 06:30 PM
const slaAfterHours = calculateSLADeadlines('CRITICAL', tue8pm, testHolidays);
assert(
  formatToIST(slaAfterHours.responseDueAt) === '25 Nov 2026, 11:30:00 am IST',
  `After-hours response due Wednesday 11:30 AM IST (got ${formatToIST(slaAfterHours.responseDueAt)})`
);
assert(
  formatToIST(slaAfterHours.resolutionDueAt) === '25 Nov 2026, 06:30:00 pm IST',
  `After-hours resolution due Wednesday 06:30 PM IST (got ${formatToIST(slaAfterHours.resolutionDueAt)})`
);

// Sunday afternoon 03:00 PM -> snaps to Monday 09:30 AM
const sun3pm = fromISTComponents(2026, 10, 22, 15, 0, 0);
const nextWorkingSun = getNextWorkingTime(sun3pm, testHolidays);
assert(
  formatToIST(nextWorkingSun) === '23 Nov 2026, 09:30:00 am IST',
  `Weekend timestamp snaps to Monday 09:30 AM IST (got ${formatToIST(nextWorkingSun)})`
);

// -----------------------------------------------------------------------------
// TEST CASE 5: Ticket created before a configured holiday
// -----------------------------------------------------------------------------
console.log('\n5. Testing Ticket Created Before a Configured Holiday:');
// Thursday Nov 26, 2026 at 5:00 PM IST (1.5h = 90 min remaining in shift).
// Friday Nov 27 is a configured Holiday.
// Add 2 working hours (120 min):
// 90 min used Thursday. 30 min rolls over.
// Friday (holiday), Saturday, Sunday are skipped!
// 30 min on Monday Nov 30 at 09:30 AM -> Monday Nov 30 10:00 AM IST!
const thu5pm = fromISTComponents(2026, 10, 26, 17, 0, 0);
const slaPreHoliday = calculateSLADeadlines('CRITICAL', thu5pm, testHolidays);
assert(
  formatToIST(slaPreHoliday.responseDueAt) === '30 Nov 2026, 10:00:00 am IST',
  `Holiday & weekend skipped: Response due Monday Nov 30 10:00 AM IST (got ${formatToIST(slaPreHoliday.responseDueAt)})`
);

// -----------------------------------------------------------------------------
// TEST CASE 6: Ticket waiting for customer response for several working days (Pause/Resume)
// -----------------------------------------------------------------------------
console.log('\n6. Testing Ticket Waiting for Customer Response for Multiple Days:');
// Created Monday 10:00 AM. Initial response due 12:00 PM Monday (120 min)
const ticketBase = {
  responseDueAt: slaMonCritical.responseDueAt,
  resolutionDueAt: slaMonCritical.resolutionDueAt,
  firstResponseAt: null,
  resolvedAt: null,
};

// Enters WAITING_FOR_CUSTOMER on Monday 11:00 AM
const pauseStart = fromISTComponents(2026, 10, 23, 11, 0, 0);
// Resumes on Wednesday 11:00 AM (2 full working days = 2 * 540 = 1080 working minutes)
const pauseEnd = fromISTComponents(2026, 10, 25, 11, 0, 0);

const pausedMins = calculateWorkingMinutesBetween(pauseStart, pauseEnd, testHolidays);
assert(pausedMins === 1080, `Exactly 2 working days (1080 min) calculated during pause (got ${pausedMins})`);

const resumedDeadlines = extendDeadlinesForPause(ticketBase, pausedMins, testHolidays);
// Original response due was Mon 12:00 PM. Adding 1080 working min (2 working days) -> Wed 12:00 PM!
assert(
  formatToIST(resumedDeadlines.responseDueAt) === '25 Nov 2026, 12:00:00 pm IST',
  `SLA clock resumed: Response deadline pushed to Wednesday 12:00 PM IST (got ${formatToIST(resumedDeadlines.responseDueAt)})`
);
// Original resolution was Mon 6:30 PM. Adding 1080 working min (2 working days) -> Wed 6:30 PM!
assert(
  formatToIST(resumedDeadlines.resolutionDueAt) === '25 Nov 2026, 06:30:00 pm IST',
  `SLA clock resumed: Resolution deadline pushed to Wednesday 06:30 PM IST (got ${formatToIST(resumedDeadlines.resolutionDueAt)})`
);

// -----------------------------------------------------------------------------
// TEST CASE 7: Ticket with multiple waiting periods
// -----------------------------------------------------------------------------
console.log('\n7. Testing Multiple Waiting Periods:');
// Pause 1: Mon 11:00 AM to Mon 01:00 PM (2 working hours = 120 min)
// Pause 2: Mon 03:00 PM to Mon 06:00 PM (3 working hours = 180 min)
const pauses = [
  {
    startedAt: fromISTComponents(2026, 10, 23, 11, 0, 0),
    endedAt: fromISTComponents(2026, 10, 23, 13, 0, 0),
  },
  {
    startedAt: fromISTComponents(2026, 10, 23, 15, 0, 0),
    endedAt: fromISTComponents(2026, 10, 23, 18, 0, 0),
  },
];
const totalPaused = calculateTotalPausedWorkingMinutes(pauses, testHolidays);
assert(totalPaused === 300, `Total paused across 2 periods is 300 working minutes (5 hours) (got ${totalPaused})`);

// -----------------------------------------------------------------------------
// TEST CASE 8: Priority change from Small to Critical (Rule 6)
// -----------------------------------------------------------------------------
console.log('\n8. Testing Priority Change from Small to Critical:');
// Changed on Wednesday Nov 25 at 2:00 PM IST
const changeTime = fromISTComponents(2026, 10, 25, 14, 0, 0);
const recalculated = recalculateOnPriorityChange('CRITICAL', changeTime, testHolidays);

// Critical response: +2 working hours from change time -> Wednesday 04:00 PM IST
assert(
  formatToIST(recalculated.responseDueAt) === '25 Nov 2026, 04:00:00 pm IST',
  `Priority change to Critical: Response recalculated to Wednesday 04:00 PM IST (got ${formatToIST(recalculated.responseDueAt)})`
);
// Critical resolution: same working day end of shift -> Wednesday 06:30 PM IST
assert(
  formatToIST(recalculated.resolutionDueAt) === '25 Nov 2026, 06:30:00 pm IST',
  `Priority change to Critical: Resolution recalculated to Wednesday 06:30 PM IST (got ${formatToIST(recalculated.resolutionDueAt)})`
);

// -----------------------------------------------------------------------------
// TEST CASE 9: Overdue Status Evaluation & Suppression (Rule 8)
// -----------------------------------------------------------------------------
console.log('\n9. Testing Overdue Evaluation & Suppression Rules (Rule 8):');
const ticketForOverdue = {
  status: 'IN_PROGRESS',
  firstResponseAt: null,
  responseDueAt: fromISTComponents(2026, 10, 23, 12, 0, 0), // Mon 12:00 PM
  resolutionDueAt: fromISTComponents(2026, 10, 23, 18, 30, 0),
  resolvedAt: null,
};

// Check during working hours on Monday 02:00 PM (past response deadline of 12:00 PM)
const mon2pm = fromISTComponents(2026, 10, 23, 14, 0, 0);
const evalWorking = evaluateOverdueStatus(ticketForOverdue, testHolidays, mon2pm);
assert(evalWorking.isOverdue === true && evalWorking.responseOverdue === true, 'Ticket is marked OVERDUE during working hours when deadline has passed');

// Check outside working hours on Sunday evening 08:00 PM
const sun8pm = fromISTComponents(2026, 10, 22, 20, 0, 0);
const evalSunday = evaluateOverdueStatus(ticketForOverdue, testHolidays, sun8pm);
assert(
  evalSunday.isOverdue === false && evalSunday.status === 'SUPPRESSED_NON_WORKING_TIME',
  'Rule 8: Overdue status is SUPPRESSED on Sunday outside working hours'
);

// Check when ticket is in WAITING_FOR_CUSTOMER status
const pausedTicket = { ...ticketForOverdue, status: 'WAITING_FOR_CUSTOMER' };
const evalPaused = evaluateOverdueStatus(pausedTicket, testHolidays, mon2pm);
assert(
  evalPaused.isOverdue === false && evalPaused.status === 'PAUSED',
  'Overdue status is PAUSED while ticket is in WAITING_FOR_CUSTOMER'
);

console.log(`\n========================================`);
console.log(`SLA Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
