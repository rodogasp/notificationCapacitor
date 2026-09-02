package notification.test

import android.app.Notification
import android.app.NotificationChannel
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build

class NotificationManager(private val context: Context) {

    private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    fun getNotificationChannel(name: String): NotificationChannel? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null
        return context.getSystemService(android.app.NotificationManager::class.java)
            .getNotificationChannel(name)
    }

    fun getActiveNotificationChannelId(): String? = preferences.getString(KEY_ACTIVE_CHANNEL_ID, null)

    fun ensureIncomingCallChannel(
        muted: Boolean,
        vibration: String,
        ringtoneUri: String?,
    ): String {
        val activeId = getActiveNotificationChannelId()
        val activeChannel = activeId?.let(::getNotificationChannel)
        if (activeId != null && activeChannel?.importance == android.app.NotificationManager.IMPORTANCE_HIGH) {
            return activeId
        }
        return updateNotificationChannel(muted, vibration, ringtoneUri)
    }

    fun createNotificationChannel(
        channelId: String,
        muted: Boolean,
        vibration: String,
        ringtoneUri: String?,
    ): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return channelId

        val ringtone = ringtoneUri?.let(Uri::parse) ?: defaultRingtoneUri()
        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val channel = NotificationChannel(
            channelId,
            NotificationChannelNames.INCOMING_CALL,
            android.app.NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Incoming call alerts"
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            enableVibration(vibration != VIBRATION_OFF)
            vibrationPattern = vibrationPattern(vibration)
            setSound(if (muted) null else ringtone, if (muted) null else attributes)
        }
        context.getSystemService(android.app.NotificationManager::class.java)
            .createNotificationChannel(channel)
        return channelId
    }

    fun removeNotificationChannel(name: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.getSystemService(android.app.NotificationManager::class.java)
                .deleteNotificationChannel(name)
        }
    }

    fun updateNotificationChannel(
        muted: Boolean,
        vibration: String,
        ringtoneUri: String?,
    ): String {
        // Android freezes a channel's sound/vibration properties after creation.
        // A fresh ID is required for new sound/vibration settings to take effect.
        val previousId = getActiveNotificationChannelId()
        val channelId = "${NotificationChannelNames.INCOMING_CALL_ID_PREFIX}_${System.currentTimeMillis()}"
        createNotificationChannel(channelId, muted, vibration, ringtoneUri)
        if (previousId != null) removeNotificationChannel(previousId)
        preferences.edit().putString(KEY_ACTIVE_CHANNEL_ID, channelId).apply()
        return channelId
    }

    fun defaultRingtoneUri(): Uri =
        RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_RINGTONE)
            ?: android.provider.Settings.System.DEFAULT_RINGTONE_URI

    /** Vibration Settings */
    private fun vibrationPattern(vibration: String): LongArray = when (vibration) {
        VIBRATION_SHORT -> longArrayOf(0, 180)
        VIBRATION_MEDIUM -> longArrayOf(0, 360, 180, 360)
        VIBRATION_LONG -> longArrayOf(0, 800, 240, 800)
        else -> longArrayOf(0)
    }

    companion object {
        private const val PREFERENCES = "incoming_call_notification_manager"
        private const val KEY_ACTIVE_CHANNEL_ID = "active_channel_id"
        const val VIBRATION_OFF = "off"
        const val VIBRATION_SHORT = "short"
        const val VIBRATION_MEDIUM = "medium"
        const val VIBRATION_LONG = "long"
    }
}
