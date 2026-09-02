package notification.test;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MediaPlayback")
public final class MediaPlaybackPlugin extends Plugin {
    private PluginCall pendingCall;

    @PluginMethod public void selectMediaFile(PluginCall call) {
        pendingCall = call;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("audio/*").addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "fileSelected");
    }

    @PluginMethod public void showNotification(PluginCall call) { start(call, MediaPlaybackService.ACTION_SHOW); }
    @PluginMethod public void startPlayer(PluginCall call) { start(call, MediaPlaybackService.ACTION_PLAY); }
    @PluginMethod public void stopPlayer(PluginCall call) { start(call, MediaPlaybackService.ACTION_STOP); }
    @PluginMethod public void startForegroundService(PluginCall call) { start(call, MediaPlaybackService.ACTION_START_SERVICE); }
    @PluginMethod public void stopForegroundService(PluginCall call) { start(call, MediaPlaybackService.ACTION_STOP_SERVICE); }

    private void start(PluginCall call, String action) {
        if (Build.VERSION.SDK_INT >= 33) getActivity().requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7002);
        Intent intent = new Intent(getContext(), MediaPlaybackService.class).setAction(action);
        if (Build.VERSION.SDK_INT >= 26) ContextCompat.startForegroundService(getContext(), intent); else getContext().startService(intent);
        JSObject result = new JSObject().put("status", action + " requested"); call.resolve(result);
    }

    @Override protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        PluginCall call = pendingCall;
        pendingCall = null;
        if (call == null) return;
        if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) { call.reject("No audio file selected"); return; }
        Uri uri = data.getData();
        getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        MediaPlaybackService.setMediaUri(uri.toString());
        call.resolve(new JSObject().put("name", uri.getLastPathSegment()).put("uri", uri.toString()));
    }
}
