package notification.test

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.TimeUnit

class PushWebSocketClient(private val context: Context) {

    fun connectForPush(data: Map<String, String>) {
        connect("FCM_PUSH_RECEIVED", data, "FCM push event delivered")
    }

    fun connectForCallDeclined() {
        connect("CALL_DECLINED", emptyMap(), "Call decline delivered")
    }

    private fun connect(eventType: String, data: Map<String, String>, closeReason: String) {
        val url = websocketUrl(context)
        if (url.isNullOrBlank()) {
            Log.w(TAG, "WS_EVENT_SKIPPED_NO_URL: type=$eventType")
            return
        }

        val connectionId = UUID.randomUUID().toString()
        Log.d(TAG, "WS_EVENT_CONNECTING: type=$eventType url=$url connectionId=$connectionId")
        val client = OkHttpClient.Builder()
            .pingInterval(15, TimeUnit.SECONDS)
            .build()
        val request = Request.Builder().url(url).build()

        client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "WS_EVENT_OPEN: type=$eventType connectionId=$connectionId")
                webSocket.send(JSONObject().put("type", "hello").put("connectionId", connectionId).toString())
                val event = JSONObject()
                    .put("type", eventType)
                    .put("connectionId", connectionId)
                data.forEach { (key, value) -> event.put(key, value) }
                webSocket.send(event.toString())
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WS_EVENT_CLOSING: type=$eventType connectionId=$connectionId code=$code reason=$reason")
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WS_EVENT_CLOSED: type=$eventType connectionId=$connectionId code=$code reason=$reason")
                client.dispatcher.executorService.shutdown()
            }

            override fun onFailure(webSocket: WebSocket, throwable: Throwable, response: Response?) {
                Log.e(TAG, "WS_EVENT_ERROR: type=$eventType connectionId=$connectionId message=${throwable.message}")
                client.dispatcher.executorService.shutdown()
            }
        })
    }

    companion object {
        private const val TAG = "PushWebSocket"
        private const val PREFERENCES = "push_websocket_settings"
        private const val KEY_URL = "url"
        private const val CLOSE_DELAY_MS = 1_500L

        fun saveBackendUrl(context: Context, backendUrl: String): String? {
            val websocketUrl = toWebSocketUrl(backendUrl)
            context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_URL, websocketUrl)
                .apply()
            return websocketUrl
        }

        fun websocketUrl(context: Context): String? =
            context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                .getString(KEY_URL, null)

        private fun toWebSocketUrl(backendUrl: String): String? {
            if (backendUrl.isBlank()) return null
            return backendUrl.trim().replace(Regex("/+$"), "")
                .replaceFirst("https://", "wss://")
                .replaceFirst("http://", "ws://") + "/ws"
        }
    }
}