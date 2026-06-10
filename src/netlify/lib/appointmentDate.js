import { DateTime } from 'luxon';

const TIME_ZONE = 'America/Halifax';
const WEEKDAYS = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};
const MONTHS = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const BOOKING_HELP =
  'Use a booking like "Friday at noon", "Friday 12 at noon", "June 12 at 10am", or "2026-06-12 10:00".';

function parseTime(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/^at\s+/i, '')
    .replace(/\s+/g, ' ');

  if (/^(?:12\s+(?:at\s+)?)?(?:noon|midday)$/i.test(normalized)) {
    return {
      hour: 12,
      minute: 0,
    };
  }

  if (/^(?:12\s+(?:at\s+)?)?midnight$/i.test(normalized)) {
    return {
      hour: 0,
      minute: 0,
    };
  }

  const match = normalized.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i,
  );

  if (!match) {
    throw new Error(BOOKING_HELP);
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3]?.toLowerCase();

  if (minute > 59) {
    throw new Error(BOOKING_HELP);
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) {
      throw new Error(BOOKING_HELP);
    }

    if (meridiem === 'am') {
      hour = hour === 12 ? 0 : hour;
    } else {
      hour = hour === 12 ? 12 : hour + 12;
    }
  } else if (hour >= 1 && hour <= 7) {
    hour += 12;
  } else if (hour > 23) {
    throw new Error(BOOKING_HELP);
  }

  return {
    hour,
    minute,
  };
}

function createAppointment(parts) {
  const appointment = DateTime.fromObject(parts, {
    zone: TIME_ZONE,
  });

  if (!appointment.isValid) {
    throw new Error(BOOKING_HELP);
  }

  return appointment;
}

function ensureFuture(appointment, now, allowNextYear = false) {
  let result = appointment;

  if (allowNextYear && result <= now) {
    result = result.plus({ years: 1 });
  }

  if (result <= now) {
    throw new Error('Booking time must be in the future.');
  }

  return result;
}

function getWeekdayAppointment(now, weekdayName, time, modifier = '') {
  const targetWeekday = WEEKDAYS[weekdayName.toLowerCase()];
  let daysAhead = (targetWeekday - now.weekday + 7) % 7;

  if (modifier.toLowerCase() === 'next') {
    daysAhead = daysAhead === 0 ? 7 : daysAhead + 7;
  }

  let appointment = now.plus({ days: daysAhead }).set({
    ...time,
    second: 0,
    millisecond: 0,
  });

  if (appointment <= now) {
    appointment = appointment.plus({ days: 7 });
  }

  return appointment;
}

function ensureMatchingWeekday(appointment, weekdayName) {
  const expectedWeekday = WEEKDAYS[weekdayName.toLowerCase()];

  if (appointment.weekday !== expectedWeekday) {
    throw new Error(
      `${appointment.toFormat('LLLL d, yyyy')} is a ${appointment.toFormat(
        'cccc',
      )}, not a ${weekdayName.toLowerCase()}.`,
    );
  }
}

export function parseBookingDate(value, nowValue = DateTime.now()) {
  const input = String(value || '').trim().replace(/\s+/g, ' ');
  const now = DateTime.isDateTime(nowValue)
    ? nowValue.setZone(TIME_ZONE)
    : DateTime.fromJSDate(nowValue, { zone: TIME_ZONE });

  const isoMatch = input.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(?:at\s+)?(.+)$/i,
  );
  let appointment;

  if (isoMatch) {
    const time = parseTime(isoMatch[4]);
    appointment = ensureFuture(
      createAppointment({
        year: Number(isoMatch[1]),
        month: Number(isoMatch[2]),
        day: Number(isoMatch[3]),
        ...time,
      }),
      now,
    );
  } else {
    const monthMatch = input.match(
      /^(?:(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+)?([a-z]+)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\s+(?:at\s+)?(.+)$/i,
    );

    if (monthMatch && MONTHS[monthMatch[2].toLowerCase()]) {
      const time = parseTime(monthMatch[5]);
      const hasYear = Boolean(monthMatch[4]);
      appointment = ensureFuture(
        createAppointment({
          year: hasYear ? Number(monthMatch[4]) : now.year,
          month: MONTHS[monthMatch[2].toLowerCase()],
          day: Number(monthMatch[3]),
          ...time,
        }),
        now,
        !hasYear,
      );

      if (monthMatch[1]) {
        ensureMatchingWeekday(appointment, monthMatch[1]);
      }
    } else {
      const weekdayDateMatch = input.match(
        /^(?:(next|this)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+at\s+(.+)$/i,
      );

      if (weekdayDateMatch) {
        const time = parseTime(weekdayDateMatch[4]);
        appointment = getWeekdayAppointment(
          now,
          weekdayDateMatch[2],
          time,
          weekdayDateMatch[1],
        );

        if (appointment.day !== Number(weekdayDateMatch[3])) {
          throw new Error(
            `The requested ${weekdayDateMatch[2].toLowerCase()} is ${appointment.toFormat(
              'LLLL d',
            )}, not the ${Number(weekdayDateMatch[3])}.`,
          );
        }
      } else {
        const relativeDateMatch = input.match(
          /^(today|tomorrow)\s+(?:at\s+)?(.+)$/i,
        );

        if (relativeDateMatch) {
          const time = parseTime(relativeDateMatch[2]);
          const daysAhead =
            relativeDateMatch[1].toLowerCase() === 'tomorrow' ? 1 : 0;
          appointment = ensureFuture(
            now.plus({ days: daysAhead }).set({
              ...time,
              second: 0,
              millisecond: 0,
            }),
            now,
          );
        } else {
          const weekdayMatch = input.match(
            /^(?:(next|this)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?(.+)$/i,
          );

          if (!weekdayMatch) {
            throw new Error(BOOKING_HELP);
          }

          const time = parseTime(weekdayMatch[3]);
          appointment = getWeekdayAppointment(
            now,
            weekdayMatch[2],
            time,
            weekdayMatch[1],
          );
        }
      }
    }
  }

  return {
    appointmentAt: appointment.toISO(),
    displayText: appointment.toFormat("cccc, LLLL d 'at' h:mm a"),
  };
}
