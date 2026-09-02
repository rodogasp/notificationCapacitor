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
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;

public final class MediaPlaybackService extends Service {
    static final String ACTION_SHOW = "notification.test.SHOW";
    static final String ACTION_PLAY = "notification.test.PLAY";
    static final String ACTION_STOP = "notification.test.STOP";
    static final String ACTION_START_SERVICE = "notification.test.START_SERVICE";
    static final String ACTION_STOP_SERVICE = "notification.test.STOP_SERVICE";
    static final String EXTRA_URI = "media_uri";
    private static final String TAG = "MediaPlaybackService";
    private static final String CHANNEL_ID = "media_playback";
    private static final int NOTIFICATION_ID = 41;
    private ExoPlayer player;
    private MediaSession mediaSession;
    private static String mediaUri;

    public static void setMediaUri(String uri) { mediaUri = uri; }

    @Override public void onCreate() {
        super.onCreate();
        Log.i(TAG, "Service created");
        createChannel();
        player = new ExoPlayer.Builder(this).build();
        player.addListener(new Player.Listener() {
            @Override public void onIsPlayingChanged(boolean isPlaying) { Log.i(TAG, isPlaying ? "Playback started" : "Playback stopped"); updateNotification(); }
        });
        mediaSession = new MediaSession.Builder(this, player).build();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        Log.i(TAG, "Action: " + action);
        if (intent != null && intent.hasExtra(EXTRA_URI)) mediaUri = intent.getStringExtra(EXTRA_URI);
        if (ACTION_STOP_SERVICE.equals(action)) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); return START_NOT_STICKY; }
        if (ACTION_PLAY.equals(action)) play();
        if (ACTION_STOP.equals(action)) player.stop();
        startForeground(NOTIFICATION_ID, buildNotification());
        return START_STICKY;
    }

    void play() {
        if (mediaUri == null) { Log.w(TAG, "No media file selected"); return; }
        if (player.getMediaItemCount() == 0 || !mediaUri.equals(player.getCurrentMediaItem().localConfiguration.uri.toString())) {
            player.setMediaItem(MediaItem.fromUri(mediaUri));
            player.prepare();
        }
        player.play();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(new NotificationChannel(CHANNEL_ID, "Media playback", NotificationManager.IMPORTANCE_LOW));
    }

    private PendingIntent command(String action) {
        return PendingIntent.getService(this, action.hashCode(), new Intent(this, MediaPlaybackService.class).setAction(action), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification buildNotification() {
        NotificationCompat.Action play = new NotificationCompat.Action(android.R.drawable.ic_media_play, "Start Player", command(ACTION_PLAY));
        NotificationCompat.Action stop = new NotificationCompat.Action(android.R.drawable.ic_media_pause, "Stop Player", command(ACTION_STOP));
        NotificationCompat.Action start = new NotificationCompat.Action(android.R.drawable.ic_media_play, "Start Foreground Service", command(ACTION_START_SERVICE));
        NotificationCompat.Action stopService = new NotificationCompat.Action(android.R.drawable.ic_menu_close_clear_cancel, "Stop Foreground Service", command(ACTION_STOP_SERVICE));
        return new NotificationCompat.Builder(this, CHANNEL_ID).setSmallIcon(android.R.drawable.ic_media_play).setContentTitle("Background audio playback").setContentText(player != null && player.isPlaying() ? "Playing" : "Stopped").setOngoing(true).setOnlyAlertOnce(true).addAction(play).addAction(stop).addAction(start).addAction(stopService).setStyle(new androidx.media.app.NotificationCompat.MediaStyle().setMediaSession(mediaSession.getSessionCompatToken())).build();
    }

    private void updateNotification() { if (player != null) ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICATION_ID, buildNotification()); }
    @Override public void onDestroy() { Log.i(TAG, "Service destroyed"); if (mediaSession != null) mediaSession.release(); if (player != null) player.release(); super.onDestroy(); }
    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}
