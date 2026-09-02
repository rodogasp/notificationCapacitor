# FCM Test App

Minimal Capacitor Android proof of concept for registering an FCM token, sending it to a backend, and displaying Firebase notifications.

## Requirements

- Node.js and npm
- Android Studio and Android SDK
- A Firebase project
- A physical Android device with USB debugging, or an Android emulator
- A backend that uses the same Firebase project

## Install and build

```bash
npm install
npm run build
npx cap sync android
npx cap open android
```

For a browser development session:

```bash
npm run dev
```

The browser UI and log window work there, but FCM registration requires the native Android Capacitor app.

After changing web files, run:

```bash
npm run build
npx cap sync android
```

## Firebase setup

1. Create or select a Firebase project.
2. Add an Android app with package name `com.example.fcmtest`.
3. Download the real `google-services.json`.
4. Put it at `android/app/google-services.json`.
5. Confirm the backend sends through this same Firebase project.
6. Do not commit this file until you have checked that it contains no server credentials. It is ignored by this project.

This project does not include a fake Firebase configuration. Without the real file, the web build works, but Android FCM registration will not work.

The app does not contain Firebase service-account credentials, private keys, FCM server keys, or backend secrets. The optional Bearer token is stored in local storage only for this proof of concept; production credentials must use secure storage.

## Device test

1. Connect a physical Android device with USB debugging enabled, or start an emulator.
2. Open the project with `npx cap open android`.
3. Add `android/app/google-services.json` and run the app from Android Studio.
4. Enter the backend base URL. The app posts to `/api/v1/devices`.
5. Enter a test JWT only if the backend requires it.
6. Press **Initialize Notifications**.
7. Confirm the FCM token appears in the token field and logs.
8. Press **Register Token With Backend**.
9. Send an FCM notification from the backend.
10. Test once with the app open and once with it in the background.
11. Tap the background notification and check the app log after it opens.
12. Use **Send Local Test Notification** to test local notifications without Firebase or the backend.

The registration request is:

```http
POST {BACKEND_BASE_URL}/api/v1/devices
Content-Type: application/json
Authorization: Bearer <TEST_JWT>
```

```json
{
  "token": "FCM_REGISTRATION_TOKEN",
  "deviceId": "capacitor-android-test-device",
  "deviceName": "Capacitor Android Test",
  "appVersion": "1.0.0",
  "notificationsEnabled": true
}
```

Conceptual FCM message:

```json
{
  "notification": {
    "title": "Hello from backend",
    "body": "FCM is working"
  },
  "data": {
    "type": "TEST",
    "source": "backend"
  }
}
```

If the backend exposes a send endpoint, an example is:

```bash
curl -X POST "https://backend.example.test/api/v1/notifications/devices" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TEST_JWT>' \
  -d '{
    "token": "FCM_REGISTRATION_TOKEN",
    "notification": {"title": "Hello from backend", "body": "FCM is working"},
    "data": {"type": "TEST", "source": "backend"}
  }'
```

## Network notes

- `localhost` on an Android device means the device itself.
- Android emulator access to the host machine commonly uses `10.0.2.2`.
- A physical device needs the computer LAN IP or a deployed backend.
- HTTPS is preferred. This project does not weaken Android network security globally for HTTP.

## Troubleshooting

- Permission denied: enable notifications for **FCM Test App** in Android system settings, then reinstall or initialize again.
- No token: confirm the real Firebase file matches package `com.example.fcmtest` and that the Android device has Google Play services.
- Backend connection failure: verify the URL is reachable from the device, firewall rules allow it, and HTTPS certificates are valid.
- Invalid JWT: paste a current test token; the app never writes it to logs.
- Duplicate foreground notifications: foreground messages are displayed once through Local Notifications; background notification payloads are displayed automatically by Android/FCM and are not scheduled locally.
- Tap not logged: ensure the app was rebuilt after `npm run build && npx cap sync android`, then tap a notification generated while the app was backgrounded.

No real FCM delivery is claimed until a real Firebase configuration, backend, and Android device are supplied.