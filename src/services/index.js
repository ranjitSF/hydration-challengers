import { apiUrl } from '../config/app';

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const checkRoster = (email) => request('/players/login-check', { method: 'POST', body: { email } });
export const requestSignInLink = (email) => request('/players/request-link', { method: 'POST', body: { email } });
export const syncPlayer = (token) => request('/players/sync', { method: 'POST', token });
export const getPlayers = () => request('/players');
export const getMatches = () => request('/matches');
export const getMyPicks = (token) => request('/picks/me', { token });
export const saveDraft = (picks, finalGoals, token) => request('/picks', { method: 'POST', body: { picks, finalGoals, submit: false }, token });
export const submitPicks = (picks, finalGoals, token) => request('/picks', { method: 'POST', body: { picks, finalGoals, submit: true }, token });
export const getPlayerBracket = (id) => request(`/players/${encodeURIComponent(id)}/bracket`);
export const getPlayerProjection = (id) => request(`/players/${encodeURIComponent(id)}/projection`);
export const getStandings = () => request('/standings');
export const getLive = (token) => request('/live', { token });
export const getScenario = () => request('/scenario');
export const getConfig = () => request('/config');

export const adminUpdateMatch = (id, body, token) => request(`/admin/matches/${id}`, { method: 'PUT', body, token });
export const adminSetResult = (matchId, winner, token) =>
  request(`/admin/results/${matchId}`, { method: 'PUT', body: { winner }, token });
export const adminSetStartingPoints = (playerId, startingPoints, token) =>
  request(`/admin/players/${playerId}/starting-points`, { method: 'PUT', body: { startingPoints }, token });
export const adminGetStatus = (token) => request('/admin/status', { token });
export const adminPollScores = (token) => request('/admin/poll-scores', { method: 'POST', token });
export const adminSetR32 = (game, winner, token) =>
  request(`/admin/r32/${game}`, { method: 'PUT', body: { winner }, token });
