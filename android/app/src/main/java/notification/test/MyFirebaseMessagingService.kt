package notification.test

import android.util.Log
import androidx.core.app.NotificationManagerCompat
import com.capacitorjs.plugins.pushnotifications.MessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Extends Capacitor's own FCM service (instead of replacing it) so the JS side keeps receiving
 * `registration`/`pushNotificationReceived` events. On top of that, a data-only INCOMING_CALL
 * message triggers a single notification that uses a full-screen intent to display over the
 * lock screen, targeting the system call interface through [IncomingCallNotification].
 */
class MyFirebaseMessagingService : MessagingService() {

    companion object {
        private const val TAG = "MyFcmService"
        private const val DATA_TYPE_INCOMING_CALL = "INCOMING_CALL"
    }


    // "dial" -> processDialPush(sharedPreferences, map)
    // "hangup" -> processHangupPush(sharedPreferences, map)
    // "chat" -> processChatPush(sharedPreferences, map)
    // "pushseen" -> processSeenPush(sharedPreferences, map)
    // "unpair" -> processUnpairPush(sharedPreferences)
    
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "onMessageReceived: data=${remoteMessage.data} hasNotificationPayload=${remoteMessage.notification != null}")
        // The WebView owns the long-lived signaling socket. Do not open a second
        // native socket for an FCM event.
        if (remoteMessage.notification != null) {
            Log.w(TAG, "onMessageReceived: message carries a notification payload; it must be data-only or Android may auto-display it and skip this code")
        }
        if (remoteMessage.data["type"] != DATA_TYPE_INCOMING_CALL) {
            Log.d(TAG, "onMessageReceived: type is not INCOMING_CALL, ignoring")
            return
        }
        getSharedPreferences(CallWebSocketService.PREFERENCES, MODE_PRIVATE).edit()
            .putString(CallWebSocketService.KEY_CALL_ID, remoteMessage.data["callId"]).apply()
        showLockScreenNotification(remoteMessage.data["callerName"] ?: "Unknown caller")
    }

    private fun showLockScreenNotification(callerName: String) {
        val incomingCallNotification = IncomingCallNotification(this)
        NotificationManagerCompat.from(this).notify(
            IncomingCallNotification.NOTIFICATION_ID,
            incomingCallNotification.build(callerName),
        )
        Log.d(TAG, "showLockScreenNotification: system call notification posted")
    }
}
