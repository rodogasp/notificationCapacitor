package notification.test

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class CallWebSocketService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null


    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> stopCallSocket()
            else -> {
                setCallActive(true)
                acquireWakeLock()
                startForeground(NOTIFICATION_ID, foregroundNotification())
                Log.d(TAG, "CALL_SERVICE_STARTED")
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        releaseWakeLock()
        Log.d(TAG, "WS_SERVICE_DESTROYED")
        Log.d(TAG, "CALL_SERVICE_DESTROYED")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun stopCallSocket() {
        setCallActive(false)
        releaseWakeLock()
        Log.d(TAG, "CALL_SERVICE_STOP_REQUESTED")
        stopSelf()
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        wakeLock = getSystemService(PowerManager::class.java).newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "$packageName:active-call",
        ).apply {
            setReferenceCounted(false)
            acquire()
        }
        Log.d(TAG, "CALL_WAKE_LOCK_ACQUIRED")
    }

    private fun releaseWakeLock() {
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        Log.d(TAG, "CALL_WAKE_LOCK_RELEASED")
    }

    private fun setCallActive(active: Boolean) {
        getSharedPreferences(PREFERENCES, MODE_PRIVATE).edit()
            .putBoolean(KEY_CALL_ACTIVE, active).apply()
    }

    private fun foregroundNotification(): android.app.Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                FOREGROUND_CHANNEL_ID,
                "Active call connection",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                setSound(null, null)
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }

        val openApp = PendingIntent.getActivity(
            this,
            NOTIFICATION_ID,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, FOREGROUND_CHANNEL_ID)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle("Call connection active")
            .setContentText("Keeping the call connection alive")
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(openApp)
            .build()
    }

    companion object {
        private const val TAG = "CallWebSocketService"
        private const val ACTION_START = "notification.test.START_CALL_SOCKET"
        private const val ACTION_STOP = "notification.test.STOP_CALL_SOCKET"
        private const val FOREGROUND_CHANNEL_ID = "active_call_connection"
        private const val NOTIFICATION_ID = 4202
        const val PREFERENCES = "active_call_state"
        const val KEY_CALL_ACTIVE = "call_active"
        const val KEY_CALL_ID = "call_id"

        fun start(context: Context) {
            val intent = Intent(context, CallWebSocketService::class.java).setAction(ACTION_START)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.startService(Intent(context, CallWebSocketService::class.java).setAction(ACTION_STOP))
        }
    }
}
