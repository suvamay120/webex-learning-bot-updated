import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const handler = async (input = {}) => {
  const { learners = [], meta = {} } = input;
  const { activityStatus = 'moderately_active', daysThreshold = 15 } = meta;

  const messages = learners.map(l => {
    const base = `Hi ${l.fullName}, your course ${l.courseName} is ending in ${l.daysLeft} days`;
    let text;
    if (activityStatus === 'moderately_active') {
      text = `${base}. Please complete your classes to sit in the final exam.`;
    } else if (activityStatus === 'inactive') {
      text = `${base}. Please login to the portal and check course completion is possible or extend the duration.`;
    } else {
      text = `${base}.`;
    }
    return {
      email: l.email,
      text,
      meta: { id: l.id, daysLeft: l.daysLeft, activityStatus: l.activityStatus, daysThreshold }
    };
  });

  return {
    messages,
    meta: { count: messages.length, activityStatus, daysThreshold }
  };
};