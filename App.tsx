import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  ActivityIndicator,
  BackHandler,
  Platform,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import messaging from '@react-native-firebase/messaging';

const SITE_URL = 'https://app.chatssync.online';

export default function App() {
  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  // Ask notification permission + get FCM token
  useEffect(() => {
    (async () => {
      try {
        await messaging().requestPermission();
        const token = await messaging().getToken();
        if (token) setFcmToken(token);
      } catch (e) {
        // ignore – app still works without push
      }
    })();

    // When a notification is tapped and app opens, reload site
    const unsub = messaging().onNotificationOpenedApp(() => {
      webRef.current?.reload();
    });
    return unsub;
  }, []);

  // Android hardware back button -> WebView back
  useEffect(() => {
    const onBack = () => {
      if (canGoBack) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [canGoBack]);

  // JS injected into the website: hand the FCM token to the page so
  // Chatwoot's web app can register it with the server.
  const injectedJS = fcmToken
    ? `
      (function() {
        try {
          window.CHATSSYNC_FCM_TOKEN = '${fcmToken}';
          window.localStorage.setItem('chatssync_fcm_token', '${fcmToken}');
          window.dispatchEvent(new CustomEvent('chatssync-fcm-token', { detail: '${fcmToken}' }));
        } catch (e) {}
        true;
      })();
    `
    : 'true;';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.container}>
        <WebView
          ref={webRef}
          source={{ uri: SITE_URL }}
          originWhitelist={['*']}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
          injectedJavaScript={injectedJS}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          allowsBackForwardNavigationGestures={true}
          pullToRefreshEnabled={true}
          setSupportMultipleWindows={false}
          mediaPlaybackRequiresUserAction={false}
          style={styles.webview}
        />
        {loading && (
          <View style={styles.loader} pointerEvents="none">
            <ActivityIndicator size="large" color="#2F6BFF" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  webview: { flex: 1, backgroundColor: '#ffffff' },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});
