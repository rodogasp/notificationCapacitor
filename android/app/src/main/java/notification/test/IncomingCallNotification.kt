package notification.test

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class IncomingCallNotification(private val context: Context) {

    fun build(callerName: String): android.app.Notification {
        val manager = NotificationManager(context)
        val channelId = manager.ensureIncomingCallChannel(
            muted = false,
            vibration = NotificationManager.VIBRATION_MEDIUM,
            ringtoneUri = null,
        )
        val channel = manager.getNotificationChannel(channelId)
        Log.d(
            "IncomingCallNotification",
            "build: channel=$channelId muted=${channel?.sound == null} vibration=${channel?.shouldVibrate()}",
        )
        val acceptIntent = PendingIntent.getBroadcast(
            context,
            NOTIFICATION_ID,
            Intent(context, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_ACCEPT),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val fullScreenIntent = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID,
            Intent(context, IncomingCallActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra(IncomingCallActivity.EXTRA_CALLER_NAME, callerName)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val declineIntent = PendingIntent.getBroadcast(
            context,
            NOTIFICATION_ID,
            Intent(context, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_DECLINE),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(context, channelId)
            .setSmallIcon(context.applicationInfo.icon)
            .setContentTitle("Incoming call")
            .setContentText(callerName)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenIntent, true)
            .setContentIntent(acceptIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declineIntent)
            .addAction(android.R.drawable.ic_menu_call, "Accept", acceptIntent)
            .build()
    }

    fun cancel() {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }

    companion object {
        const val NOTIFICATION_ID = 4201
    }
}
