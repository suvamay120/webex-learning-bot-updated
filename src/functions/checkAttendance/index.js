import dotenv from 'dotenv';
import { getRulesList, getCourses, getAllUsers, computeNotifications } from '../../shared/dynamoService.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const handler = async () => {
  console.log('CheckAttendanceFunction start');
  const rules = await getRulesList();
  const courses = await getCourses();
  const users = await getAllUsers();
  console.log(JSON.stringify({ stage: 'input_counts', rules: rules.length, courses: courses.length, users: users.length }));
  const notifications = computeNotifications(rules, users, courses);
  console.log(JSON.stringify({ stage: 'computed', notifications: notifications.length }));

  return {
    notifications,
    meta: {
      count: notifications.length,
      rulesApplied: rules.map(r => r.ruleId)
    }
  };
};
