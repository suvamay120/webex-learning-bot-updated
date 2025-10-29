export function daysUntil(endDateStr) {
  const end = new Date(endDateStr);
  const now = new Date();
  const ms = end.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function isEndingWithin(endDateStr, thresholdDays) {
  return daysUntil(endDateStr) <= thresholdDays;
}

export function filterLearners(learners, activityStatus, thresholdDays) {
  return (learners || []).filter(l => {
    return (
      (activityStatus ? l.activityStatus === activityStatus : true) &&
      isEndingWithin(l.endDate, thresholdDays)
    );
  });
}