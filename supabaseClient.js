(function () {
  const queryParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const authType = queryParams.get('type') || hashParams.get('type');
  const hasAuthTokens = hashParams.has('access_token') && hashParams.has('refresh_token');
  const isPasswordLink = authType === 'recovery' || authType === 'invite' || hasAuthTokens;

  if (isPasswordLink) {
    sessionStorage.setItem('passwordRecoveryPending', '1');
    if (window.location.pathname !== '/accept-invite.html') {
      const destination = new URL('/accept-invite.html', window.location.origin);
      destination.search = window.location.search;
      destination.hash = window.location.hash;
      window.supabaseAuthRedirecting = true;
      window.location.replace(destination.toString());
      return;
    }
  }

  const SUPABASE_URL = 'https://tmlpwjmxogetkrmexiss.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aTheA_ubMZW54ZJ17p7bQA_GGhNzCeC';

  window.SUPABASE_CONFIG = {
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
  };

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    window.supabaseClient = null;
    window.supabaseSetupError = 'Biblioteca Supabase não carregada. Verifique o script CDN do @supabase/supabase-js.';
    return;
  }

  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
})();
