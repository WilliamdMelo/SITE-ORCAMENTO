import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://site-orcamento-five.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
]);

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CreateUserRequest = {
  email?: string;
  full_name?: string;
  role?: 'superadmin' | 'user';
  redirect_to?: string;
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ error: 'Origem não permitida.' }, 403, req);
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405, req);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Configuração Supabase indisponível.' }, 500, req);
  }

  const authorization = req.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: 'Não autenticado.' }, 401, req);
  }

  const { data: callerProfile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();

  if (profileError || callerProfile?.role !== 'superadmin') {
    return jsonResponse({ error: 'Acesso negado.' }, 403, req);
  }

  let payload: CreateUserRequest;
  try {
    payload = await req.json();
  } catch (_) {
    return jsonResponse({ error: 'JSON inválido.' }, 400, req);
  }

  const email = String(payload.email || '').trim().toLowerCase();
  const fullName = String(payload.full_name || '').trim();
  const role = payload.role === 'superadmin' ? 'superadmin' : 'user';
  const redirectTo = normalizeAllowedRedirect(payload.redirect_to);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Email inválido.' }, 400, req);
  }
  if (!fullName) {
    return jsonResponse({ error: 'Nome obrigatório.' }, 400, req);
  }
  if (!redirectTo) {
    return jsonResponse({ error: 'URL de convite não permitida.' }, 400, req);
  }

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });

  if (inviteError?.code === 'email_exists' || inviteError?.message?.toLowerCase().includes('already been registered')) {
    const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers();
    if (usersError) {
      return jsonResponse({ error: usersError.message }, 500, req);
    }

    const existingUser = usersData.users.find((user) => user.email?.toLowerCase() === email);
    if (!existingUser) {
      return jsonResponse({ error: 'Usuário existente não encontrado.' }, 500, req);
    }

    const { error: recoveryError } = await adminClient.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (recoveryError) {
      return jsonResponse({ error: recoveryError.message }, 400, req);
    }

    const { error: existingProfileError } = await adminClient
      .from('user_profiles')
      .upsert({
        id: existingUser.id,
        email,
        full_name: fullName,
        role,
      });

    if (existingProfileError) {
      return jsonResponse({ error: existingProfileError.message }, 500, req);
    }

    return jsonResponse({
      user: {
        id: existingUser.id,
        email,
        full_name: fullName,
        role,
      },
      link_type: 'recovery',
    }, 200, req);
  }

  if (inviteError || !inviteData.user) {
    return jsonResponse({ error: inviteError?.message || 'Falha ao criar convite.' }, 400, req);
  }

  const { error: upsertError } = await adminClient
    .from('user_profiles')
    .upsert({
      id: inviteData.user.id,
      email,
      full_name: fullName,
      role,
    });

  if (upsertError) {
    return jsonResponse({ error: upsertError.message }, 500, req);
  }

  return jsonResponse({
    user: {
      id: inviteData.user.id,
      email,
      full_name: fullName,
      role,
    },
    link_type: 'invite',
  }, 200, req);
});

function normalizeAllowedRedirect(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const url = new URL(value);
    if (!allowedOrigins.has(url.origin)) return null;
    if (url.pathname !== '/accept-invite.html') return null;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch (_) {
    return null;
  }
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin');
  return {
    ...corsHeaders,
    ...(origin && allowedOrigins.has(origin) ? {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    } : {}),
  };
}

function jsonResponse(body: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  });
}
