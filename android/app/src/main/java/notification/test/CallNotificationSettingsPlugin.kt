package notification.test

import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import androidx.core.content.getSystemService
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import androidx.activity.result.ActivityResult
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.firebase.messaging.FirebaseMessaging

@CapacitorPlugin(name = "CallNotificationSettings")
class CallNotificationSettingsPlugin : Plugin() {

    @PluginMethod
    fun deleteFcmToken(call: PluginCall) {
        FirebaseMessaging.getInstance().deleteToken()
            .addOnSuccessListener { call.resolve() }
            .addOnFailureListener { error -> call.reject("Could not delete FCM token", error) }
    }

    @PluginMethod
    fun getSettings(call: PluginCall) {
        call.resolve(settings(context))
    }

    @PluginMethod
    fun isCallActive(call: PluginCall) {
        val active = context.getSharedPreferences(
            CallWebSocketService.PREFERENCES, Context.MODE_PRIVATE,
        ).getBoolean(CallWebSocketService.KEY_CALL_ACTIVE, false)
        call.resolve(JSObject().put("active", active))
    }

    @PluginMethod
    fun getCallId(call: PluginCall) {
        val id = context.getSharedPreferences(CallWebSocketService.PREFERENCES, Context.MODE_PRIVATE)
            .getString(CallWebSocketService.KEY_CALL_ID, null)
        call.resolve(JSObject().put("callId", id))
    }

    @PluginMethod
    fun setPushWebSocketBackend(call: PluginCall) {
        val backendUrl = call.getString("backendUrl")
        if (backendUrl.isNullOrBlank()) {
            call.reject("backendUrl is required")
            return
        }
        val websocketUrl = PushWebSocketClient.saveBackendUrl(context, backendUrl)
        call.resolve(JSObject().put("websocketUrl", websocketUrl))
    }

    @PluginMethod
    fun applySettings(call: PluginCall) {
        val muted = call.getBoolean("muted", false) ?: false
        val vibration = call.getString("vibration", NotificationManager.VIBRATION_MEDIUM)
            ?: NotificationManager.VIBRATION_MEDIUM
        val ringtoneUri = call.getString("ringtoneUri")
        apply(context, muted, vibration, ringtoneUri)
        call.resolve(settings(context))
    }

    @PluginMethod
    fun pickRingtone(call: PluginCall) {
        val intent = Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
            putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_RINGTONE)
            putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, true)
            putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, ringtoneUri(context))
        }
        startActivityForResult(call, intent, "handleRingtoneResult")
    }

    @ActivityCallback
    private fun handleRingtoneResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val ringtone = result.data?.getParcelableExtra<Uri>(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
        call.resolve(JSObject().put("uri", ringtone?.toString()))
    }

    companion object {
        private const val PREFS = "incoming_call_notification_settings"
        private const val KEY_MUTED = "muted"
        private const val KEY_VIBRATION = "vibration"
        private const val KEY_RINGTONE_URI = "ringtone_uri"
        fun ensureChannel(context: Context): String {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val manager = NotificationManager(context)
            return manager.ensureIncomingCallChannel(
                prefs.getBoolean(KEY_MUTED, false),
                prefs.getString(KEY_VIBRATION, NotificationManager.VIBRATION_MEDIUM)
                    ?: NotificationManager.VIBRATION_MEDIUM,
                prefs.getString(KEY_RINGTONE_URI, null),
            )
        }

        fun settings(context: Context): JSObject {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val manager = NotificationManager(context)
            val channelId = ensureChannel(context)
            val channel = manager.getNotificationChannel(channelId)
            val muted = channel?.sound == null
            val vibration = when (channel?.vibrationPattern?.toList()) {
                listOf(0L, 180L) -> NotificationManager.VIBRATION_SHORT
                listOf(0L, 800L, 240L, 800L) -> NotificationManager.VIBRATION_LONG
                listOf(0L) -> NotificationManager.VIBRATION_OFF
                else -> NotificationManager.VIBRATION_MEDIUM
            }
            val ringtoneUri = channel?.sound?.toString()
                ?: prefs.getString(KEY_RINGTONE_URI, ringtoneUri(context).toString())
            return JSObject()
                .put("channelId", channelId)
                .put("muted", muted)
                .put("vibration", vibration)
                .put("ringtoneUri", ringtoneUri)
        }

        private fun apply(context: Context, muted: Boolean, vibration: String, ringtoneUri: String?): String {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val updatedChannelId = NotificationManager(context).updateNotificationChannel(
                muted,
                vibration,
                ringtoneUri,
            )

            prefs.edit()
                .putBoolean(KEY_MUTED, muted)
                .putString(KEY_VIBRATION, vibration)
                .putString(KEY_RINGTONE_URI, ringtoneUri)
                .apply()
            return updatedChannelId
        }

        private fun ringtoneUri(context: Context): Uri =
            RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_RINGTONE)
                ?: android.provider.Settings.System.DEFAULT_RINGTONE_URI

    }
}