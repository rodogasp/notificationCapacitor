package notification.test;

import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MediaPlayback")
public final class MediaPlaybackPlugin extends Plugin {
    @PluginMethod
    public void startForegroundService(PluginCall call) {
        send(call, MediaPlaybackService.START);
    }

    @PluginMethod
    public void stopForegroundService(PluginCall call) {
        send(call, MediaPlaybackService.STOP_SERVICE);
    }

    private void send(PluginCall call, String action) {
        Intent intent = new Intent(getContext(), MediaPlaybackService.class).setAction(action);
        if (Build.VERSION.SDK_INT >= 26) ContextCompat.startForegroundService(getContext(), intent);
        else getContext().startService(intent);
        call.resolve(new JSObject().put("status", action + " requested"));
    }
}
