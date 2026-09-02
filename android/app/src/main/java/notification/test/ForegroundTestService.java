package notification.test;

import android.app.*;
import android.content.*;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public final class ForegroundTestService extends Service {
    private static final String CHANNEL = "foreground_test";
    private static final int ID = 100;

    @Override public void onCreate() {
        super.onCreate();
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (android.os.Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Foreground test", NotificationManager.IMPORTANCE_LOW));
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, ForegroundTestService.class).setAction("stop"), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notification = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("WebView audio experiment")
            .setContentText("Foreground service active; audio remains in WebView")
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop service", stop)
            .build();
        startForeground(ID, notification);
        if (intent != null && "stop".equals(intent.getAction())) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); }
        return START_STICKY;
    }

    @Override public void onDestroy() { super.onDestroy(); }
    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}
