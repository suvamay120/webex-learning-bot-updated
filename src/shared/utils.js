export function daysUntilDate(dateStr) {
  const end = new Date(dateStr);
  const now = new Date();
  const ms = end.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function isWithinDaysBefore(dateStr, daysBefore) {
  const d = daysUntilDate(dateStr);
  return d === daysBefore;
}

export function daysAfterDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const ms = now.getTime() - date.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function isMissedByDays(dateStr, daysAfter) {
  const d = daysAfterDate(dateStr);
  return d === daysAfter;
}
