import dotenv from 'dotenv';
import { getLearners } from '../../shared/dbService.js';
import { daysUntil, filterLearners } from '../../shared/utils.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const handler = async (event = {}) => {
  const activityStatus = event.activityStatus || 'moderately_active';
  const daysThreshold = event.daysThreshold ?? 15;

  const learners = await getLearners();
  const filtered = filterLearners(learners, activityStatus, daysThreshold).map(l => ({
    id: l.id,
    email: l.email,
    fullName: l.fullName,
    courseName: l.courseName,
    endDate: l.endDate,
    daysLeft: daysUntil(l.endDate),
    activityStatus: l.activityStatus
  }));

  return {
    learners: filtered,
    meta: {
      count: filtered.length,
      daysThreshold,
      activityStatus
    }
  };
};