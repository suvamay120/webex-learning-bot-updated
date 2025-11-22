import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const handler = async (input = {}) => {
  const { learners = [], meta = {} } = input;
  const { activityStatus = 'moderately_active', daysThreshold = 15, rules = {} } = meta;

  const messages = learners.map(l => {
    const courseRule = rules?.courseRules?.[l.courseName] || {};
    const minReq = courseRule.minClassesRequired ?? 0;
    const closingSoonDays = courseRule.closingSoonDays ?? daysThreshold;
    const isInactive = l.activityStatus === 'inactive';
    const closingSoon = l.daysLeft <= closingSoonDays;
    const belowThreshold = (l.attendedClasses ?? 0) < minReq;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const missedYesterday = l.lastClassDate ? new Date(l.lastClassDate) < yesterday : false;

    const base = `Hi ${l.fullName}, your course ${l.courseName} is ending in ${l.daysLeft} days`;
    let text = `${base}.`;
    if (isInactive) {
      text = `${base}. Your activity appears inactive. Please login and resume classes.`;
    } else if (closingSoon && belowThreshold) {
      text = `${base}. You have attended ${l.attendedClasses ?? 0} classes; minimum required is ${minReq}. Please catch up before the course closes.`;
    } else if (closingSoon) {
      text = `${base}. Please complete your classes to meet completion criteria.`;
    } else if (belowThreshold) {
      text = `${base}. You have not met the minimum class threshold (${minReq}). Please attend upcoming sessions.`;
    } else if (missedYesterday && l.upcomingNextClassDate) {
      text = `${base}. You missed yesterday's class. Next class is on ${l.upcomingNextClassDate}. Please attend.`;
    }
    return {
      email: l.email,
      text,
      meta: { id: l.id, daysLeft: l.daysLeft, activityStatus: l.activityStatus, daysThreshold, minReq, closingSoonDays }
    };
  });

  return {
    messages,
    meta: { count: messages.length, activityStatus, daysThreshold }
  };
};
