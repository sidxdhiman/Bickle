// Shared recurrence expansion so the Calendar page and the notification bell
// always agree on when a repeating event actually occurs.

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const addMonths = (date, amount) => {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + amount);
  if (next.getDate() !== day) {
    next.setDate(0);
  }
  return next;
};

export const buildRecurringOccurrences = (event, rangeStart, rangeEnd) => {
  if (!event.recurrence || event.recurrence.frequency === 'none') {
    return [event];
  }

  const frequency = event.recurrence.frequency;
  const interval = Math.max(1, Number(event.recurrence.interval) || 1);
  const duration = event.end.getTime() - event.start.getTime();
  const eventStart = startOfDay(event.start);
  const recurrenceEnd = event.recurrence.endDate ? startOfDay(new Date(event.recurrence.endDate)) : null;
  const effectiveEnd = recurrenceEnd && recurrenceEnd < rangeEnd ? recurrenceEnd : rangeEnd;

  if (effectiveEnd < eventStart || rangeEnd < eventStart) {
    return [];
  }

  const occurrences = [];
  let current = new Date(eventStart);

  const addOccurrence = (date) => {
    const start = new Date(date);
    start.setHours(event.start.getHours(), event.start.getMinutes(), event.start.getSeconds(), event.start.getMilliseconds());
    const end = new Date(start.getTime() + duration);
    occurrences.push({
      ...event,
      start,
      end,
      occurrenceDate: new Date(start),
    });
  };

  if (frequency === 'daily') {
    while (current <= effectiveEnd) {
      if (current >= rangeStart) addOccurrence(current);
      current = addDays(current, interval);
    }
    return occurrences;
  }

  if (frequency === 'weekdays') {
    while (current <= effectiveEnd) {
      const day = current.getDay();
      if (current >= rangeStart && day !== 0 && day !== 6) addOccurrence(current);
      current = addDays(current, 1);
    }
    return occurrences;
  }

  if (frequency === 'weekly') {
    while (current <= effectiveEnd) {
      if (current >= rangeStart) addOccurrence(current);
      current = addDays(current, interval * 7);
    }
    return occurrences;
  }

  if (frequency === 'monthly') {
    while (current <= effectiveEnd) {
      if (current >= rangeStart) addOccurrence(current);
      current = addMonths(current, interval);
    }
    return occurrences;
  }

  return [];
};
