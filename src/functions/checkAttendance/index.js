import dotenv from 'dotenv';
import { getRulesList, getCourses, getAllUsers, computeNotifications } from '../../shared/dynamoService.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const handler = async () => {
  const rules = await getRulesList();
  const courses = await getCourses();
  const users = await getAllUsers();
  const notifications = computeNotifications(rules, users, courses);

  return {
    notifications,
    meta: {
      count: notifications.length,
      rulesApplied: rules.map(r => r.ruleId)
    }
  };
};
