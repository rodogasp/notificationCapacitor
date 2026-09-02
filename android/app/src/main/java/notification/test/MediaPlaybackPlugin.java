package notification.test;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MediaPlayback")
public final class MediaPlaybackPlugin extends Plugin {
    private PluginCall pending;
    @PluginMethod public void selectMediaFile(PluginCall call) { pending = call; Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"video/*", "video/x-matroska", "audio/*", "application/octet-stream"}).addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION); startActivityForResult(call, intent, "selected"); }
    @PluginMethod public void showNotification(PluginCall call) { command(call, MediaPlaybackService.SHOW); }
    @PluginMethod public void startPlayer(PluginCall call) { command(call, MediaPlaybackService.PLAY); }
    @PluginMethod public void stopPlayer(PluginCall call) { command(call, MediaPlaybackService.STOP); }
    @PluginMethod public void startForegroundService(PluginCall call) { command(call, MediaPlaybackService.START); }
    @PluginMethod public void stopForegroundService(PluginCall call) { command(call, MediaPlaybackService.STOP_SERVICE); }
    private void command(PluginCall call, String action) { Intent intent = new Intent(getContext(), MediaPlaybackService.class).setAction(action); if (Build.VERSION.SDK_INT >= 26) ContextCompat.startForegroundService(getContext(), intent); else getContext().startService(intent); call.resolve(new JSObject().put("status", action + " requested")); }
    @ActivityCallback
    public void selected(PluginCall call, ActivityResult result) {
        pending = null;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { call.reject("No video selected"); return; }
        try { Uri uri = result.getData().getData(); getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION); MediaPlaybackService.setUri(uri.toString()); call.resolve(new JSObject().put("name", uri.getLastPathSegment()).put("uri", uri.toString())); } catch (Exception error) { call.reject("Could not access selected video: " + error.getMessage()); }
    }
}
