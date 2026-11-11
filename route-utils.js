(function (root) {
  function roundTo(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function parseDurationSeconds(duration) {
    const match = typeof duration === 'string' ? duration.match(/^([0-9]+(?:\.[0-9]+)?)s$/) : null;
    if (!match) throw new Error('Duração de rota inválida.');
    const seconds = Number(match[1]);
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Duração de rota inválida.');
    return seconds;
  }

  function normalizeRouteResponse(payload) {
    const route = payload?.routes?.[0];
    const distanceMeters = Number(route?.distanceMeters);
    const durationSeconds = parseDurationSeconds(route?.duration);
    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) throw new Error('Distância de rota inválida.');

    const distanceKm = roundTo(distanceMeters / 1000);
    const durationHours = roundTo(durationSeconds / 3600);
    const totalMinutes = Math.round(durationSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return {
      distanceKm,
      durationHours,
      formattedDistance: `${distanceKm.toFixed(2).replace('.', ',')} km`,
      formattedDuration: hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${minutes} min`,
    };
  }

  const routeUtils = { normalizeRouteResponse, parseDurationSeconds };
  root.routeUtils = routeUtils;
  if (typeof module !== 'undefined' && module.exports) module.exports = routeUtils;
})(typeof globalThis !== 'undefined' ? globalThis : this);
