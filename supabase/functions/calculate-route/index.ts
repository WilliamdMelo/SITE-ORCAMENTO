import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import './route-utils.js';

declare global {
  var routeUtils: {
    normalizeRouteResponse: (payload: unknown) => {
      distanceKm: number;
      durationHours: number;
      formattedDistance: string;
      formattedDuration: string;
    };
  };
}

const allowedOrigins = new Set([
  'https://site-orcamento-five.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
]);

const routeOrigin = 'Parque Empresarial Arnaldo - Rua Alberto Tibúrcio Peixoto, R. Euclídes Francisco Peixoto, nº 271, Tijucas - SC, 88207-899';
const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RouteRequest = {
  destination?: {
    address?: string;
    placeId?: string;
  };
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  if (origin && !allowedOrigins.has(origin)) return jsonResponse({ error: 'Origem não permitida.' }, 403, req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405, req);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const googleMapsKey = Deno.env.get('GOOGLE_MAPS_SERVER_KEY');
  if (!supabaseUrl || !anonKey || !googleMapsKey) {
    return jsonResponse({ error: 'Configuração da rota indisponível.' }, 500, req);
  }

  const authorization = req.headers.get('Authorization') || '';
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonResponse({ error: 'Não autenticado.' }, 401, req);

  let payload: RouteRequest;
  try {
    payload = await req.json();
  } catch (_) {
    return jsonResponse({ error: 'JSON inválido.' }, 400, req);
  }

  const address = String(payload.destination?.address || '').trim();
  if (!address || address.length > 500) {
    return jsonResponse({ error: 'Informe um endereço de destino válido.' }, 400, req);
  }

  let googleResponse: Response;
  try {
    googleResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleMapsKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({
        origin: { address: routeOrigin },
        destination: { address },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        computeAlternativeRoutes: false,
        units: 'METRIC',
        languageCode: 'pt-BR',
      }),
    });
  } catch (_) {
    return jsonResponse({ error: 'Não foi possível consultar o Google Maps.' }, 502, req);
  }

  if (!googleResponse.ok) {
    return jsonResponse({ error: 'O Google Maps não encontrou uma rota para esse destino.' }, 422, req);
  }

  try {
    const routeData = await googleResponse.json();
    const normalized = globalThis.routeUtils.normalizeRouteResponse(routeData);
    return jsonResponse(normalized, 200, req);
  } catch (_) {
    return jsonResponse({ error: 'Resposta de rota inválida.' }, 502, req);
  }
});

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin');
  return {
    ...corsHeaders,
    ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
  };
}

function jsonResponse(body: unknown, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}
