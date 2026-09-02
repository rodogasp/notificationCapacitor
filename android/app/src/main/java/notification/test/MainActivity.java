package notification.test;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(android.os.Bundle state) {
		registerPlugin(MediaPlaybackPlugin.class);
		super.onCreate(state);
	}
}
