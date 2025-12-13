import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { UserModel, RuleModel, CourseModel } from './dynamooseModels.js';
import { daysUntilDate, isWithinDaysBefore, isMissedByDays } from './utils.js';

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
      enrolledCourseIds: u.enrolledCourseIds || [],
      attendedCourseIds: u.attendedCourseIds || [],
      notificationState: 'pending'
    })) : [];
  }
  const items = await UserModel.scan().exec();
  return (items || []).map(i => ({
    id: i.userId,
    email: i.email,
    fullName: i.fullName,
    enrolledCourseIds: Array.isArray(i.enrolledCourseIds) ? i.enrolledCourseIds : [],
    attendedCourseIds: Array.isArray(i.attendedCourseIds) ? i.attendedCourseIds : [],
    notificationState: i.notificationState || 'pending'
  }));
}

export function computeNotifications(rules, users, courses) {
  const courseById = new Map((courses || []).map(c => [c.courseId, c]));
  const courseByName = new Map((courses || []).map(c => [c.name, c]));
  const notifications = [];
  const activeRules = (rules || []).filter(r => r.active !== false);
  for (const u of users || []) {
    const enrolledIds = Array.isArray(u.enrolledCourseIds) && u.enrolledCourseIds.length > 0
      ? u.enrolledCourseIds
      : Array.isArray(u.enrolledCourses)
        ? u.enrolledCourses.map(n => courseByName.get(n)?.courseId).filter(Boolean)
        : [];
    const attendedIdsArr = Array.isArray(u.attendedCourseIds) && u.attendedCourseIds.length > 0
      ? u.attendedCourseIds
      : Array.isArray(u.attendedCourses)
        ? u.attendedCourses.map(n => courseByName.get(n)?.courseId).filter(Boolean)
        : [];
    const attendedIds = new Set(attendedIdsArr);
    for (const r of activeRules) {
      if (r.type === 'course_upcoming_soon') {
        const daysBefore = r?.config?.daysBefore ?? 3;
        for (const cid of enrolledIds) {
          const course = courseById.get(cid);
          if (!course) continue;
          if (isWithinDaysBefore(course.date, daysBefore)) {
            notifications.push({
              type: 'attend_soon',
              ruleId: r.ruleId,
              email: u.email,
              fullName: u.fullName,
              userId: u.id,
              courseName: course.name,
              courseDate: course.date,
              daysToGo: daysUntilDate(course.date)
            });
          }
        }
      } else if (r.type === 'course_missed') {
        const daysAfter = r?.config?.daysAfter ?? 1;
        for (const cid of enrolledIds) {
          const course = courseById.get(cid);
          if (!course) continue;
          const attendedThis = attendedIds.has(cid);
          if (!attendedThis && isMissedByDays(course.date, daysAfter)) {
            notifications.push({
              type: 'missed',
              ruleId: r.ruleId,
              email: u.email,
              fullName: u.fullName,
              userId: u.id,
              courseName: course.name,
              courseDate: course.date,
              daysAfter
            });
          }
        }
      } else if (r.type === 'weekly_broadcast') {
        if (enrolledIds.length === 0) {
          const now = new Date();
          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
          const upcoming = (courses || []).filter(c => {
            const d = new Date(c.date);
            return d >= nextMonth && d <= monthEnd;
          }).map(c => ({ name: c.name, date: c.date }));
          if (upcoming.length > 0) {
            notifications.push({
              type: 'weekly_broadcast',
              ruleId: r.ruleId,
              email: u.email,
              fullName: u.fullName,
              userId: u.id,
              coursesList: upcoming
            });
          }
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
