package notification.test;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override public void onCreate(android.os.Bundle state) {
		registerPlugin(ForegroundTestPlugin.class);
		super.onCreate(state);
	}
}
