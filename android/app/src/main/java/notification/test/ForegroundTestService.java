package notification.test;

import android.app.*;
import android.content.*;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public final class ForegroundTestService extends Service {
    static final String ACTION_PLAY = "notification.test.PLAY";
    static final String ACTION_PAUSE = "notification.test.PAUSE";
    static final String BROWSER_COMMAND = "notification.test.BROWSER_COMMAND";
    private static final String CHANNEL = "foreground_test";
    private static final int ID = 100;

    @Override public void onCreate() {
        super.onCreate();
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (android.os.Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Foreground test", NotificationManager.IMPORTANCE_LOW));
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if ("stop".equals(action)) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); return START_NOT_STICKY; }
        if (ACTION_PLAY.equals(action) || ACTION_PAUSE.equals(action)) sendBroadcast(new Intent(BROWSER_COMMAND).setPackage(getPackageName()).putExtra("action", action));
        PendingIntent play = command(ACTION_PLAY);
        PendingIntent pause = command(ACTION_PAUSE);
        PendingIntent stop = command("stop");
        Notification notification = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("WebView audio experiment")
            .setContentText("Foreground service active; audio remains in WebView")
            .setOngoing(true)
            .addAction(android.R.drawable.ic_media_play, "Play", play)
            .addAction(android.R.drawable.ic_media_pause, "Pause", pause)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop service", stop)
            .build();
        startForeground(ID, notification);
        return START_STICKY;
    }

    private PendingIntent command(String action) { return PendingIntent.getService(this, action.hashCode(), new Intent(this, ForegroundTestService.class).setAction(action), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT); }

    @Override public void onDestroy() { super.onDestroy(); }
    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}
