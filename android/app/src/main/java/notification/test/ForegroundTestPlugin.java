package notification.test;

import android.content.*;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ForegroundTest")
public final class ForegroundTestPlugin extends Plugin {
    private final BroadcastReceiver browserCommands = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) { notifyListeners("browserCommand", new JSObject().put("action", intent.getStringExtra("action"))); }
    };
    @Override public void load() { super.load(); getContext().registerReceiver(browserCommands, new IntentFilter(ForegroundTestService.BROWSER_COMMAND)); }
    @Override protected void handleOnDestroy() { getContext().unregisterReceiver(browserCommands); super.handleOnDestroy(); }
    @PluginMethod public void showNotification(PluginCall call) { send(call, null); }
    @PluginMethod public void startForegroundService(PluginCall call) { send(call, null); }
    @PluginMethod public void stopForegroundService(PluginCall call) { send(call, "stop"); }
    private void send(PluginCall call, String action) {
        Intent intent = new Intent(getContext(), ForegroundTestService.class);
        if (action != null) intent.setAction(action);
        if (Build.VERSION.SDK_INT >= 26) ContextCompat.startForegroundService(getContext(), intent); else getContext().startService(intent);
        call.resolve(new JSObject().put("status", action == null ? "Foreground service started" : "Foreground service stopped"));
    }
}
