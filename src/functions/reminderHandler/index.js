import dotenv from 'dotenv';
import { getRulesList } from '../../shared/dynamoService.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const handler = async (input = {}) => {
  console.log('ReminderHandlerFunction invoked with input:', JSON.stringify(input));
  const { notifications = [], meta = {} } = input;
  const rules = await getRulesList();
  const map = new Map((rules || []).map(r => [r.ruleId, r]));

  function applyTemplate(tpl, ctx) {
    return (tpl || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
      if (k === 'coursesList') {
        const list = (ctx.coursesList || []).map(c => `${c.name} on ${c.date}`).join('; ');
        return list;
      }
      return ctx[k] != null ? String(ctx[k]) : '';
    });
  }

  const messages = notifications.map(n => {
    const rule = map.get(n.ruleId) || {};
    const text = applyTemplate(rule.message, {
      fullName: n.fullName,
      daysToGo: n.daysToGo,
      threeMonthDate: n.threeMonthDate,
      remainingCount: n.remainingCount
    }) || '';
    return {
      email: n.email,
      text,
      meta: { id: n.userId, type: n.type, ruleId: n.ruleId }
    };
  });
  const typeCounts = notifications.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({ stage: 'compose_done', messages: messages.length, typeCounts }));

  return {
    messages,
    meta: { count: messages.length, rulesApplied: meta?.rulesApplied }
  };
};
