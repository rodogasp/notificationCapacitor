# Notification Backend

Production-ready backend service for sending Firebase Cloud Messaging (FCM) push
notifications to Android devices. Built with Node.js, TypeScript, Express, Prisma,
and the Firebase Admin SDK.

## Quick start (Docker, one command)

```bash
git clone <this-repo-url>
cd notification-backend
cp .env.example .env
```

Edit `.env` and set your Firebase project:

```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CREDENTIALS_MODE=file
GOOGLE_APPLICATION_CREDENTIALS=/secrets/firebase-service-account.json
```

Download the service-account JSON (Firebase console → Project settings → Service
accounts → Generate new private key) and place it at `./secrets/firebase-service-account.json`
(the `secrets/` folder is git-ignored and mounted read-only into the container).

Then run:

```bash
docker compose up --build
```

That single command starts Postgres, waits for it to be healthy, applies all
Prisma migrations automatically (via `docker-entrypoint.sh`), and starts the API
on `http://localhost:3000`. Everything else (JWT signing secret, rate limits,
etc.) already has safe local-dev defaults baked into `docker-compose.yml` — only
the Firebase project is required. Verify with:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

See section 14 for example requests once it's running.

## 1. Architecture overview

Layered architecture, isolated by responsibility:

```
src/
  app.ts              Express app wiring (middleware, routes, error handling)
  server.ts           Process entrypoint: HTTP listen + graceful shutdown
  config/             Environment validation, logger, Firebase Admin init, Prisma client
  middleware/          Authentication, authorization, error handling, request-id, rate limiting
  modules/
    devices/           Device token registration/listing/removal (controller -> service -> repository)
    notifications/      Notification sending (controller -> service -> dispatcher/repository)
  shared/
    errors/            AppError + standard error envelope
    types/              Shared/augmented types (AuthenticatedUser, Express.Request)
    utils/              Token masking, FCM error classification
prisma/
  schema.prisma        Database schema
  seed.ts              Optional local dev seed
tests/
  unit/                Pure unit tests (mocks only)
  integration/         Route-level tests (Supertest, Firebase Admin mocked)
```

Controllers are thin (parse request, call service, shape response). Business logic
lives in services. Prisma access is confined to repositories. Notification dispatch
is isolated behind a `NotificationDispatcher` interface (`notification-dispatcher.ts`)
so a queue-backed implementation can be swapped in later without touching
`NotificationService`.

## 2. Prerequisites

- Node.js 20+
- npm
- PostgreSQL 14+ (or Docker)
- A Firebase project with Cloud Messaging enabled

## 3. Firebase project setup

1. Go to the [Firebase console](https://console.firebase.google.com/) and create/select a project.
2. Add an Android app to the project (package name must match your Android app's `applicationId`).
3. Download `google-services.json` and add it to the Android app (not to this backend).

## 4. How to enable FCM

In the Firebase console: **Project settings -> Cloud Messaging**. Ensure the
Firebase Cloud Messaging API (V1) is enabled. This backend only uses the modern
HTTP v1 API via the Firebase Admin SDK — the legacy server-key API is never used.

## 5. Application Default Credentials (production)

Recommended for production on GCP (Cloud Run, GKE, Compute Engine) or any
environment with Workload Identity / attached service accounts:

```
FIREBASE_CREDENTIALS_MODE=adc
```

No key file is required; the Admin SDK resolves credentials automatically from
the environment. Grant the runtime service account the **Firebase Cloud
Messaging API Admin** (or equivalent) IAM role.

## 6. Local service-account credential (development only)

Two supported local options — **never commit the resulting file/value**:

**Option A — file:**
```
FIREBASE_CREDENTIALS_MODE=file
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
```

**Option B — inline JSON (e.g. injected by a secrets manager/CI):**
```
FIREBASE_CREDENTIALS_MODE=json
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account", ...}
```

Download the service-account JSON from **Project settings -> Service accounts ->
Generate new private key**. Store it outside the repository (it is already
excluded via `.gitignore`) and never place it in the Android app.

## 7. PostgreSQL setup

Local Postgres:

```bash
createuser notification_user --pwprompt
createdb -O notification_user notification_db
```

Or use the bundled `docker-compose.yml` Postgres service (see section 11).

## 8. Environment variables

Copy `.env.example` to `.env` and fill in real values (never commit `.env`):

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` |
| `HOST` | Bind address (e.g. `127.0.0.1` or `0.0.0.0` in containers) |
| `PORT` | Bind port |
| `DATABASE_URL` | Postgres connection string used by Prisma |
| `LOG_LEVEL` | Pino log level |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins |
| `FIREBASE_PROJECT_ID` | Firebase project id |
| `FIREBASE_CREDENTIALS_MODE` | `adc` \| `file` \| `json` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service-account JSON (mode=file) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Inline service-account JSON (mode=json) |
| `FCM_ANDROID_CHANNEL_ID` | Must match the Android notification channel id |
| `JWT_ISSUER` | Expected JWT `iss` claim |
| `JWT_AUDIENCE` | Expected JWT `aud` claim |
| `JWT_JWKS_URL` | JWKS endpoint for signature verification (required in production) |
| `JWT_PUBLIC_KEY` | Local-dev fallback public key/shared secret when no JWKS URL is set |
| `NOTIFICATION_REQUIRED_ROLE` | Role/scope required to call notification-sending endpoints |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Rate limiting window/threshold |
| `MAX_JSON_BODY_SIZE` | Max JSON body size (e.g. `100kb`) |

## 9. Prisma migration commands

```bash
npm run prisma:generate   # generate the Prisma client
npm run prisma:migrate    # create + apply a migration in development
npm run prisma:deploy     # apply pending migrations in production/CI
npm run prisma:studio     # open Prisma Studio
```

## 10. Local startup

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

## 11. Docker startup

```bash
cp .env.example .env   # fill in FIREBASE_PROJECT_ID and Firebase credentials
docker compose up --build
```

This starts Postgres (with a health check) and the backend. The backend container's
`docker-entrypoint.sh` automatically runs `prisma migrate deploy` against the
database before starting the server, so no manual migration step is needed. See
"Quick start" above for the full walkthrough.

## 12. Test commands

```bash
npm test          # run once (Vitest)
npm run test:watch
```

All automated tests mock the Firebase Admin SDK and the Prisma client — no real
notifications are sent and no real database is required. To also validate
Prisma against a real Postgres instance, run migrations against a disposable
database and add integration coverage that talks to it directly (not wired into
`npm test` by default to keep CI hermetic).

## 13. Lint and formatting

```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

## 14. curl examples

Replace `$TOKEN` with a valid bearer JWT.

**Register a device**
```bash
curl -X POST http://localhost:3000/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"FCM_REGISTRATION_TOKEN","deviceId":"android-device-id","deviceName":"Pixel 9","appVersion":"1.0.0","notificationsEnabled":true}'
```

**List my devices**
```bash
curl http://localhost:3000/api/v1/devices -H "Authorization: Bearer $TOKEN"
```

**Remove a device (JSON body variant, recommended)**
```bash
curl -X POST http://localhost:3000/api/v1/devices/unregister \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"token":"FCM_REGISTRATION_TOKEN"}'
```

**Remove a device (path param variant, token must be percent-encoded)**
```bash
curl -X DELETE "http://localhost:3000/api/v1/devices/$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' FCM_REGISTRATION_TOKEN)" \
  -H "Authorization: Bearer $TOKEN"
```

**Send to a user (admin/service role required)**
```bash
curl -X POST http://localhost:3000/api/v1/notifications/users/USER_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 8f0e6e0a-2f2f-4b8b-8a9a-000000000001" \
  -d '{"notification":{"title":"Order updated","body":"Your order is ready"},"data":{"type":"ORDER_UPDATED","orderId":"order-123","screen":"orderDetails"}}'
```

**Send to a single device**
```bash
curl -X POST http://localhost:3000/api/v1/notifications/devices \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"token":"FCM_REGISTRATION_TOKEN","notification":{"title":"Test notification","body":"This is a test"},"data":{"type":"TEST"}}'
```

**Send to a topic**
```bash
curl -X POST http://localhost:3000/api/v1/notifications/topics/news-updates \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"notification":{"title":"News","body":"Breaking news"}}'
```

**Retrieve a notification result**
```bash
curl http://localhost:3000/api/v1/notifications/NOTIFICATION_UUID -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Health / readiness**
```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

## 15. Example responses

Success (device registration, 201):
```json
{ "id": "b6b0...", "deviceId": "android-device-id", "deviceName": "Pixel 9", "appVersion": "1.0.0", "notificationsEnabled": true, "active": true, "lastSeenAt": "2025-01-01T00:00:00.000Z" }
```

Success (send to user, 200):
```json
{ "notificationId": "c1a2...", "status": "SENT", "successCount": 2, "failureCount": 0, "totalTargets": 2 }
```

Error (standard envelope, any failure):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": [{ "path": "token", "message": "Required" }], "requestId": "b3f1c9f0-..." } }
```

## 16. Android integration flow

1. Obtain the FCM registration token:

```kotlin
FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
    sendTokenToBackend(token)
}
```

2. Send it to the backend:

```kotlin
fun sendTokenToBackend(token: String) {
    val body = JSONObject().apply {
        put("token", token)
        put("deviceId", Settings.Secure.ANDROID_ID)
        put("deviceName", Build.MODEL)
        put("appVersion", BuildConfig.VERSION_NAME)
        put("notificationsEnabled", true)
    }
    // POST to /api/v1/devices with "Authorization: Bearer <userJwt>"
}
```

3. Handle token refresh in your `FirebaseMessagingService`:

```kotlin
class MyFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        sendTokenToBackend(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        message.notification?.let { /* foreground UI handling */ }
        message.data.let { data -> /* handle data payload, e.g. navigate by data["screen"] */ }
    }
}
```

4. Request notification permission on Android 13+ (`POST_NOTIFICATIONS`):

```kotlin
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_CODE)
    }
}
```

5. Create the notification channel matching `FCM_ANDROID_CHANNEL_ID`:

```kotlin
val channel = NotificationChannel(
    "default_channel", // must equal FCM_ANDROID_CHANNEL_ID
    "General notifications",
    NotificationManager.IMPORTANCE_HIGH,
)
getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
```

## 17. Token lifecycle

1. Client registers a token via `POST /api/v1/devices` -> row created/updated, `active=true`.
2. Every registration call updates `lastSeenAt` and clears any prior invalidation.
3. If FCM reports the token as invalid/unregistered/malformed (a **permanent**
   error), the backend automatically sets `active=false`, `invalidatedAt`, and a
   sanitized `invalidationReason` — the token is never sent to again until re-registered.
4. Transient FCM errors (server unavailable, quota, etc.) never deactivate a
   token; they are logged and recorded on the delivery record for future retry.
5. Users can proactively remove a device via the unregister endpoints, which
   also just deactivates the row (no physical delete), preserving audit history.

## 18. Security considerations

- JWT signature, issuer, audience, and expiry are all verified; `sub` becomes `userId`.
- Notification-sending endpoints require an explicit role/scope
  (`NOTIFICATION_REQUIRED_ROLE`) — never exposed publicly.
- Only an allowlisted set of fields is ever forwarded into the Firebase Admin
  message; arbitrary client-supplied Firebase message properties are rejected by Zod's `.strict()`.
- Full FCM tokens, Authorization headers, JWTs, and service-account credentials are never logged (see `maskToken` and Pino redaction/serializers).
- Helmet, CORS allowlist, JSON body-size limit, and rate limiting are enabled by default.
- Stack traces and internal error details are never returned to clients in production.

## 19. Deployment notes

- Run `npm run build` then `npm start`, or use the provided multi-stage Dockerfile (non-root user, prod deps only).
- Terminate TLS at a load balancer/ingress; bind the app to `HOST=0.0.0.0` inside containers.
- Prefer Application Default Credentials over service-account JSON files in production.
- Run `prisma:deploy` (not `prisma:migrate`) in CI/CD pipelines against production databases.

## 20. Queue-based scaling recommendations

Sending is currently synchronous behind the `NotificationDispatcher` interface.
To scale out:

1. Implement a `QueueNotificationDispatcher` that publishes a dispatch job
   (notification id + target) to a broker (Google Pub/Sub, Cloud Tasks, Azure
   Service Bus, RabbitMQ, or similar) instead of calling Firebase inline.
2. Run one or more worker processes that consume jobs, call the Firebase Admin
   SDK, and write results back through the same `NotificationRepository`/
   `DeviceRepository` used today.
3. Keep the HTTP response fast (`202 Accepted` + notification id) and let
   clients poll `GET /api/v1/notifications/:notificationId` for the final result.
4. The idempotency-key mechanism already in place prevents duplicate sends if
   a job is retried or a client resubmits.
