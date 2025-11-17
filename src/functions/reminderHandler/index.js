import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const handler = async (input = {}) => {
  const { learners = [], meta = {} } = input;
  const { daysThreshold = 15 } = meta;
  console.log(`[compose] input: learners=${learners.length} daysThreshold=${daysThreshold}`);

  const messages = learners.map(l => {
    const base = `Hi ${l.fullName}, your course ${l.courseName} is ending in ${l.daysLeft} days`;
    let text;
    // Personalize by each learner's activity status
    switch (l.activityStatus) {
      case 'inactive':
        text = `${base}. Please login to the portal and check course completion is possible or extend the duration.`;
        break;
      case 'moderately_active':
        text = `${base}. Please complete your classes to sit in the final exam.`;
        break;
      case 'highly_active':
      case 'active':
        text = `${base}. Great progress — keep it up!`;
        break;
      default:
        text = `${base}.`;
    }
    return {
      email: l.email,
      text,
      meta: { id: l.id, daysLeft: l.daysLeft, activityStatus: l.activityStatus, daysThreshold }
    };
  });

  console.log(`[compose] output: messages=${messages.length}`);
  // If NOTIFICATION_QUEUE_URL is set, we only compose and let Step Functions
  // call EnqueueMessagesFunction to push to SQS. We still return messages so
  // local tests remain simple and the workflow can choose the delivery mode.
  return {
    messages,
    meta: { count: messages.length, daysThreshold }
  };
};