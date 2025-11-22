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

const UserSchema = new dynamoose.Schema({
  userId: { type: String, hashKey: true },
  uid: { type: String, default: () => crypto.randomUUID() },
  email: String,
  fullName: String,
  courseName: String,
  startDate: String,
  endDate: String,
  activityStatus: String,
  attendedClasses: Number,
  lastClassDate: String,
  upcomingNextClassDate: String,
  notificationState: { type: String, default: 'pending' },
  updatedAt: String
}, { saveUnknown: true });

const RuleSchema = new dynamoose.Schema({
  ruleId: { type: String, hashKey: true },
  uid: { type: String, default: () => crypto.randomUUID() },
  daysThreshold: Number,
  defaultActivityStatus: String,
  courseRules: Object
}, { saveUnknown: true });

export const UserModel = dynamoose.model(usersTableName, UserSchema);
export const RuleModel = dynamoose.model(rulesTableName, RuleSchema);
