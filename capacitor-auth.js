/*
 * capacitor-auth.js — bridges Supabase magic-link login into the native iOS app.
 * Catches hillardapp://login-callback#access_token=... via the Capacitor App
 * plugin, sets the session, and lands the customer in the garage.
 * In a plain browser this file is a harmless no-op.
 */
(function () {
  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }
  var SUPABASE_URL = 'https://ixgotsabbqkkxzsxnwtr.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4Z290c2FiYnFra3h6c3hud3RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTQwOTEsImV4cCI6MjA4Nzg3MDA5MX0.NNH_JEmEEvaMYuM_2F9F4qLqOFXoKb68NM-Ac3PDXyA';

  async function completeLoginFromUrl(url) {
    try {
      if (!url) return;
      var hashIndex = url.indexOf('#');
      if (hashIndex !== -1) {
        var frag = new URLSearchParams(url.substring(hashIndex + 1));
        var access_token = frag.get('access_token');
        var refresh_token = frag.get('refresh_token');
        if (access_token && refresh_token && window.supabase) {
          var c = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          await c.auth.setSession({ access_token: access_token, refresh_token: refresh_token });
          window.location.href = '/index.html';
          return;
        }
      }
      var qIndex = url.indexOf('?');
      if (qIndex !== -1) {
        var q = new URLSearchParams(url.substring(qIndex + 1));
        var code = q.get('code');
        if (code && window.supabase) {
          var c2 = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          await c2.auth.exchangeCodeForSession(code);
          window.location.href = '/index.html';
        }
      }
    } catch (e) {
      console.error('[capacitor-auth] failed to complete login:', e);
    }
  }

  function register() {
    if (!isNative()) return;
    var App = window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!App) return;
    App.addListener('appUrlOpen', function (event) {
      completeLoginFromUrl(event && event.url);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', register);
  } else {
    register();
  }
})();
