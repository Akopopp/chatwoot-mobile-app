import { registerRootComponent } from 'expo';
import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';
import messaging from '@react-native-firebase/messaging';

const SITE_URL = 'https://app.chatssync.online';

function App() {
  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  // Get FCM permission + token
  useEffect(() => {
    (async () => {
      try {
        await messaging().requestPermission();
        const token = await messaging().getToken();
        if (token) setFcmToken(token);
      } catch (e) {}
    })();

    const unsub = messaging().onNotificationOpenedApp(() => {
      webRef.current?.reload();
    });
    return unsub;
  }, []);

  // Script that hands the token to the website
  const buildInject = (token: string) => `
    (function() {
      try {
        window.CHATSSYNC_FCM_TOKEN = '${token}';
        window.localStorage.setItem('chatssync_fcm_token', '${token}');
        window.dispatchEvent(new CustomEvent('chatssync-fcm-token', { detail: '${token}' }));
      } catch (e) {}
      true;
    })();
  `;

  // KEY FIX: whenever token arrives, push it into the already-loaded page
  useEffect(() => {
    if (fcmToken && webRef.current) {
      webRef.current.injectJavaScript(buildInject(fcmToken));
    }
  }, [fcmToken]);

  // Android hardware back button
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

  // Also re-inject on every page load (covers login navigation / reloads)
  const onLoadEnd = () => {
    setFirstLoadDone(true);
    if (fcmToken && webRef.current) {
      webRef.current.injectJavaScript(buildInject(fcmToken));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.container}>
        <WebView
          ref={webRef}
          source={{ uri: SITE_URL }}
          originWhitelist={['*']}
          onLoadEnd={onLoadEnd}
          onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          pullToRefreshEnabled={true}
          setSupportMultipleWindows={false}
          mediaPlaybackRequiresUserAction={false}
          style={styles.webview}
        />
        {!firstLoadDone && (
          <View style={styles.loader}>
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
    backgroundColor: '#ffffff',
  },
});

registerRootComponent(App);

export default App;
