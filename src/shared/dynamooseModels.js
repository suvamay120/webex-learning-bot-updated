import dotenv from 'dotenv';
import dynamoose from 'dynamoose';
import crypto from 'crypto';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const region = process.env.AWS_REGION || 'us-east-1';
dynamoose.aws.region = region;

const usersTableName = process.env.USERS_TABLE_NAME || 'UsersTable';
const rulesTableName = process.env.RULES_TABLE_NAME || 'RulesTable';
const coursesTableName = process.env.COURSES_TABLE_NAME || 'CoursesTable';

const UserSchema = new dynamoose.Schema({
  userId: { type: String, hashKey: true },
  uid: { type: String, default: () => crypto.randomUUID() },
  email: String,
  fullName: String,
  joiningDate: String,
  enrolledCourseIds: { type: Array, schema: [String] },
  completedCourseIds: { type: Array, schema: [String] },
  notificationState: { type: String, default: 'pending' },
  updatedAt: String
}, { saveUnknown: true });

const RuleSchema = new dynamoose.Schema({
  ruleId: { type: String, hashKey: true },
  uid: { type: String, default: () => crypto.randomUUID() },
  name: String,
  description: String,
  type: String,
  config: Object,
  message: String,
  active: { type: Boolean, default: true }
}, { saveUnknown: true });

const CourseSchema = new dynamoose.Schema({
  courseId: { type: String, hashKey: true },
  uid: { type: String, default: () => crypto.randomUUID() },
  name: String,
  description: String
}, { saveUnknown: true });

export const UserModel = dynamoose.model(usersTableName, UserSchema);
export const RuleModel = dynamoose.model(rulesTableName, RuleSchema);
export const CourseModel = dynamoose.model(coursesTableName, CourseSchema);
