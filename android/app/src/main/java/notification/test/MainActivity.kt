package notification.test

import android.os.Bundle
import android.os.Build
import android.Manifest
import android.util.Log
import android.webkit.WebView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    private val microphonePermissionRequestCode = 4101

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(CallNotificationSettingsPlugin::class.java)
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            bridge.webView.setRendererPriorityPolicy(
                WebView.RENDERER_PRIORITY_BOUND,
                true,
            )
        }
        requestMicrophonePermission()
        Log.d("MainActivity", "Capacitor BridgeActivity opened")
    }

    private fun requestMicrophonePermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            == android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            Log.d("MainActivity", "MICROPHONE_PERMISSION_GRANTED")
            return
        }
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.RECORD_AUDIO),
            microphonePermissionRequestCode,
        )
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == microphonePermissionRequestCode) {
            Log.d(
                "MainActivity",
                if (grantResults.firstOrNull() == android.content.pm.PackageManager.PERMISSION_GRANTED)
                    "MICROPHONE_PERMISSION_GRANTED"
                else "MICROPHONE_PERMISSION_DENIED",
            )
        }
    }
}
