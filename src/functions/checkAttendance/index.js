import dotenv from 'dotenv';
import { getLearners } from '../../shared/dbService.js';
import { daysUntil, filterLearners } from '../../shared/utils.js';
import { getRules, getUsersForNotification } from '../../shared/dynamoService.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const handler = async (event = {}) => {
  console.log('CheckAttendanceFunction invoked with event:', JSON.stringify(event));
  const defaults = await getRules();
  const activityStatus = event.activityStatus || defaults.activityStatus || 'moderately_active';
  const daysThreshold = event.daysThreshold ?? defaults.daysThreshold ?? 15;

  let filtered;
  if (process.env.USERS_TABLE_NAME) {
    filtered = await getUsersForNotification(activityStatus, daysThreshold);
  } else {
    const learners = await getLearners();
    filtered = filterLearners(learners, activityStatus, daysThreshold).map(l => ({
      id: l.id,
      email: l.email,
      fullName: l.fullName,
      courseName: l.courseName,
      endDate: l.endDate,
      daysLeft: daysUntil(l.endDate),
      activityStatus: l.activityStatus
    }));
  }

  return {
    learners: filtered,
    meta: {
      count: filtered.length,
      daysThreshold,
      activityStatus,
      rules: defaults
    }
  };
};
