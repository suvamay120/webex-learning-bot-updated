import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { UserModel, RuleModel } from './dynamooseModels.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export async function getRules() {
  if (!process.env.RULES_TABLE_NAME) {
    return { activityStatus: 'moderately_active', daysThreshold: 15, courseRules: {} };
  }
  let rule = await RuleModel.get('default');
  if (!rule) {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const seedPath = path.resolve(__dirname, './rules.seed.json');
      const content = await fs.readFile(seedPath, 'utf-8');
      const payload = JSON.parse(content);
      await RuleModel.create(payload, { overwrite: true });
      rule = await RuleModel.get('default');
    } catch {
      return { activityStatus: 'moderately_active', daysThreshold: 15, courseRules: {} };
    }
  }
  return {
    activityStatus: rule.defaultActivityStatus || 'moderately_active',
    daysThreshold: rule.daysThreshold ?? 15,
    courseRules: rule.courseRules || {}
  };
}

function daysUntil(endDateStr) {
  const end = new Date(endDateStr);
  const now = new Date();
  const ms = end.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export async function getUsersForNotification(activityStatus, daysThreshold) {
  if (!process.env.USERS_TABLE_NAME) return [];
  const items = await UserModel.scan().exec();
  const filtered = (items || []).filter(i => {
    const okStatus = activityStatus ? i.activityStatus === activityStatus : true;
    const left = daysUntil(i.endDate);
    const okDays = left <= daysThreshold;
    const pending = i.notificationState !== 'sent';
    return okStatus && okDays && pending;
  }).map(i => ({
    id: i.userId,
    email: i.email,
    fullName: i.fullName,
    courseName: i.courseName,
    endDate: i.endDate,
    daysLeft: daysUntil(i.endDate),
    activityStatus: i.activityStatus,
    attendedClasses: i.attendedClasses ?? 0,
    lastClassDate: i.lastClassDate,
    upcomingNextClassDate: i.upcomingNextClassDate
  }));
  return filtered;
}

export async function markUserNotified(userId) {
  if (!process.env.USERS_TABLE_NAME || !userId) return;
  await UserModel.update({ userId }, { notificationState: 'sent', updatedAt: new Date().toISOString() });
}
