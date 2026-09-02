package notification.test

import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class IncomingCallActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "IncomingCallActivity"
        const val EXTRA_CALLER_NAME = "extra_caller_name"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreen()
        setContentView(R.layout.activity_incoming_call)

        val callerName = intent.getStringExtra(EXTRA_CALLER_NAME) ?: "Unknown caller"
        Log.d(TAG, "onCreate: caller=$callerName")
        findViewById<TextView>(R.id.incoming_call_title).text = "Incoming call"
        findViewById<TextView>(R.id.incoming_call_body).text = callerName
        findViewById<Button>(R.id.incoming_call_accept).setOnClickListener { accept() }
        findViewById<Button>(R.id.incoming_call_decline).setOnClickListener { decline() }
    }

    private fun showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            )
        }
    }

    private fun accept() {
        Log.d(TAG, "accept: starting persistent call WebSocket and opening Capacitor BridgeActivity")
        cancelCallNotification()
        CallWebSocketService.start(this)
        startActivity(
            Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            },
        )
        finish()
    }

    private fun decline() {
        Log.d(TAG, "decline: closing call")
        cancelCallNotification()
        PushWebSocketClient(this).connectForCallDeclined()
        finish()
    }

    private fun cancelCallNotification() {
        getSystemService(NotificationManager::class.java).cancel(IncomingCallNotification.NOTIFICATION_ID)
    }
}
