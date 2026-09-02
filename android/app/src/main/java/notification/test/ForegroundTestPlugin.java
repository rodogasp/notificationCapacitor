package notification.test;

import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ForegroundTest")
public final class ForegroundTestPlugin extends Plugin {
    @PluginMethod public void startForegroundService(PluginCall call) { send(call, null); }
    @PluginMethod public void stopForegroundService(PluginCall call) { send(call, "stop"); }
    private void send(PluginCall call, String action) {
        Intent intent = new Intent(getContext(), ForegroundTestService.class);
        if (action != null) intent.setAction(action);
        if (Build.VERSION.SDK_INT >= 26) ContextCompat.startForegroundService(getContext(), intent); else getContext().startService(intent);
        call.resolve(new JSObject().put("status", action == null ? "Foreground service started" : "Foreground service stopped"));
    }
}
