# Webex Learning Bot (Step Functions Edition)

This project sends learning reminders via Webex, orchestrated with AWS Step Functions. It’s built with Node.js and deployed using AWS SAM.

## Project Structure

```
src/
  functions/
    checkAttendance/       # Step 1: filter learners by status + end date
    reminderHandler/       # Step 2: compose personalized messages
    enqueueMessages/       # Step 3: push messages to SQS (batch)
    notificationHandler/   # SQS consumer: sends messages via Webex
  shared/
    dbService.js           # reads from src/shared/learners.json (dummy data)
    utils.js               # date math + filtering helpers
    webexService.js        # Webex API wrapper
    logger.js              # file-based logging
    learners.json          # sample learner records
  stateMachine/
    learningWorkflow.asl.json  # Step Functions definition
template.yaml                  # SAM resources (4 Lambdas + State Machine)
```

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Environment variables:

   - Local: create `.env` if you run functions directly. For NotificationHandler, set `WEBEX_BOT_TOKEN`, `REGION`, and optionally `WEBEX_MESSGING_API_URL`.
   - SAM local: `env.json` provides env vars for `CheckAttendanceFunction`, `ReminderHandlerFunction`, `EnqueueMessagesFunction`, and `NotificationHandlerFunction`.

## Local Testing

- Quick check of Step 1 (Lambda) with sample input:

  ```bash
  npm run start-lambda-local
  ```

- Orchestrate the local workflow (Check → Compose → Enqueue to SQS):

  ```bash
  npm run workflow-local
  ```

Messages are sent by `NotificationHandler` when it consumes the SQS queue (in AWS or via `sam local invoke NotificationHandlerFunction`).

  In another terminal, start an execution using AWS CLI (adjust ARN if needed):

  ```bash
  aws stepfunctions start-execution \
    --endpoint-url http://127.0.0.1:8083 \
    --name local-test \
    --state-machine arn:aws:states:local:0123456789:stateMachine:LearningWorkflowStateMachine \
    --input file://src/stateMachine/input.sample.json
  ```

## Deployment

1. Build:

   ```bash
   sam build
   ```

2. Deploy:

   ```bash
   sam deploy --guided
   ```

### Secrets and Logging

- Webex Bot Token: in Lambda, read from Secrets Manager (`WEBEX_BOT_TOKEN_SECRET_NAME`, default `WebexBotToken`). Locally, from `.env`.
- Logs: written to `logs/messages.log` locally, `/tmp/messages.log` in Lambda (configurable via `LOG_FILE_PATH`).

## Notes

- Legacy single-file entrypoint (`index.js`) and `event.json` have been removed to align with the new multi-function and Step Functions workflow.
- If `sam` isn’t recognized in your terminal, invoke it via its full path or run from a terminal where PATH includes SAM.