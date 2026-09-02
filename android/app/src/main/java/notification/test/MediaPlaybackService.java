package notification.test;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public final class MediaPlaybackService extends Service {
    static final String START = "notification.test.START";
    static final String STOP_SERVICE = "notification.test.STOP_SERVICE";
    private static final String CHANNEL = "foreground_test";
    private static final int NOTIFICATION_ID = 41;

    @Override public void onCreate() {
        super.onCreate();
        Log.i("MediaPlaybackService", "foreground service created");
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Foreground service test", NotificationManager.IMPORTANCE_LOW);
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        Log.i("MediaPlaybackService", "foreground service action=" + action);
        if (STOP_SERVICE.equals(action)) {
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }
        startForeground(NOTIFICATION_ID, notification());
        return START_STICKY;
    }

    private Notification notification() {
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, MediaPlaybackService.class).setAction(STOP_SERVICE), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("Foreground service test")
            .setContentText("Service active; WebView audio is independent")
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop Service", stop)
            .build();
    }

    @Override public void onDestroy() { Log.i("MediaPlaybackService", "foreground service destroyed"); super.onDestroy(); }
    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}
