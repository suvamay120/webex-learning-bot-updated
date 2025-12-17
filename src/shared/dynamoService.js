import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { UserModel, RuleModel, CourseModel } from './dynamooseModels.js';
import { daysUntilDate, isWithinDaysBefore, isMissedByDays, addMonths } from './utils.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export async function getRulesList() {
  if (!process.env.RULES_TABLE_NAME) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const seedPath = path.resolve(__dirname, './rules.seed.json');
    const content = await fs.readFile(seedPath, 'utf-8');
    const payload = JSON.parse(content);
    return Array.isArray(payload) ? payload : [payload];
  }
  const items = await RuleModel.scan().exec();
  return items || [];
}

export async function getCourses() {
  if (!process.env.COURSES_TABLE_NAME) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const seedPath = path.resolve(__dirname, './courses.seed.json');
    const content = await fs.readFile(seedPath, 'utf-8');
    const payload = JSON.parse(content);
    return Array.isArray(payload) ? payload : [];
  }
  const items = await CourseModel.scan().exec();
  return items || [];
}

export async function getAllUsers() {
  if (!process.env.USERS_TABLE_NAME) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const learnersPath = path.resolve(__dirname, './learners.json');
    const content = await fs.readFile(learnersPath, 'utf-8');
    const payload = JSON.parse(content);
    return Array.isArray(payload) ? payload.map(u => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      joiningDate: u.joiningDate,
      enrolledCourseIds: u.enrolledCourseIds || [],
      completedCourseIds: u.completedCourseIds || [],
      notificationState: 'pending'
    })) : [];
  }
  const items = await UserModel.scan().exec();
  return (items || []).map(i => ({
    id: i.userId,
    email: i.email,
    fullName: i.fullName,
    joiningDate: i.joiningDate,
    enrolledCourseIds: Array.isArray(i.enrolledCourseIds) ? i.enrolledCourseIds : [],
    completedCourseIds: Array.isArray(i.completedCourseIds) ? i.completedCourseIds : [],
    notificationState: i.notificationState || 'pending'
  }));
}

export function computeNotifications(rules, users, courses) {
  const notifications = [];
  const activeRules = (rules || []).filter(r => r.active !== false);
  for (const u of users || []) {
    const enrolledIds = Array.isArray(u.enrolledCourseIds) ? u.enrolledCourseIds : [];
    const completedIds = new Set(Array.isArray(u.completedCourseIds) ? u.completedCourseIds : []);
    const remainingCount = enrolledIds.filter(cid => !completedIds.has(cid)).length;
    const threeMonthDate = u?.joiningDate ? addMonths(u.joiningDate, 3) : null;
    if (!threeMonthDate) continue;
    for (const r of activeRules) {
      if (remainingCount <= 0) continue;
      if (r.type === 'joining_window_before') {
        const daysBefore = r?.config?.daysBefore ?? 7;
        if (isWithinDaysBefore(threeMonthDate, daysBefore)) {
          notifications.push({
            type: 'joining_before',
            ruleId: r.ruleId,
            email: u.email,
            fullName: u.fullName,
            userId: u.id,
            threeMonthDate,
            daysToGo: daysUntilDate(threeMonthDate),
            remainingCount
          });
        }
      } else if (r.type === 'joining_window_after') {
        const daysAfter = r?.config?.daysAfter ?? 7;
        if (isMissedByDays(threeMonthDate, daysAfter)) {
          notifications.push({
            type: 'joining_after',
            ruleId: r.ruleId,
            email: u.email,
            fullName: u.fullName,
            userId: u.id,
            threeMonthDate,
            daysAfter: daysAfter,
            remainingCount
          });
        }
      }
    }
  }
  return notifications;
}

export async function markUserNotified(userId) {
  if (!process.env.USERS_TABLE_NAME || !userId) return;
  await UserModel.update({ userId }, { notificationState: 'sent', updatedAt: new Date().toISOString() });
}
