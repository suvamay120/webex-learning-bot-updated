import dotenv from 'dotenv';
import { getLearners } from '../../shared/dbService.js';
import { daysUntil, filterLearners } from '../../shared/utils.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const handler = async (event = {}) => {
  // Accept learners from input (array at root or event.learners), else fallback to file.
  const daysThreshold = event.daysThreshold ?? 15;
  // When activityStatus is omitted, include all activities.
  const activityStatusFilter = event.activityStatus ?? undefined;

  let sourceLearners;
  if (Array.isArray(event)) {
    sourceLearners = event;
  } else if (Array.isArray(event.learners)) {
    sourceLearners = event.learners;
  } else {
    sourceLearners = await getLearners();
  }

  console.log(`[check] input: daysThreshold=${daysThreshold} activityFilter=${activityStatusFilter ?? 'all'} totalLearners=${sourceLearners.length}`);

  const filtered = filterLearners(sourceLearners, activityStatusFilter, daysThreshold).map(l => ({
    id: l.id,
    email: l.email,
    fullName: l.fullName,
    courseName: l.courseName,
    endDate: l.endDate,
    daysLeft: daysUntil(l.endDate),
    activityStatus: l.activityStatus
  }));

  console.log(`[check] output: eligible=${filtered.length}`);

  return {
    learners: filtered,
    meta: {
      count: filtered.length,
      daysThreshold,
      activityStatus: activityStatusFilter
    }
  };
};