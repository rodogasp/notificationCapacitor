package notification.test

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_DECLINE) {
            Log.d(TAG, "DECLINE_ACTION: cancelling call notification")
            IncomingCallNotification(context).cancel()
            PushWebSocketClient(context).connectForCallDeclined()
        } else if (intent.action == ACTION_ACCEPT) {
            Log.d(TAG, "ACCEPT_ACTION: starting call lifecycle service")
            IncomingCallNotification(context).cancel()
            CallWebSocketService.start(context)
            context.startActivity(Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            })
        }
    }

    companion object {
        private const val TAG = "CallActionReceiver"
        const val ACTION_DECLINE = "notification.test.DECLINE_INCOMING_CALL"
        const val ACTION_ACCEPT = "notification.test.ACCEPT_INCOMING_CALL"
    }
}
