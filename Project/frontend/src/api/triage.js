/**
 * RoadSoS Vanguard — Triage API client v3
 * ==========================================
 * Supports both:
 *   - Standard (blocking) POST /triage
 *   - SSE streaming GET /triage/stream (token-by-token from Ollama)
 *
 * Both paths fall back gracefully to mock data if the backend is unreachable.
 * All Ollama queries are LOCAL — no cloud API keys or internet required.
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

const OFFLINE_DICTIONARY = {
  bleed: {
    steps: [
      'Apply firm pressure to bleeding wounds with a clean cloth. Do not remove saturated cloth.',
      'Elevate the injured area above the heart if possible.',
      'Keep the victim still and call 112 immediately.'
    ],
    severity: 'severe',
    triage_category: 'red'
  },
  bone: {
    steps: [
      'Do not attempt to realign the bone or push a bone that\'s sticking out back in.',
      'Immobilize the injured area using a splint or sling if available.',
      'Apply ice packs to limit swelling and help relieve pain.'
    ],
    severity: 'moderate',
    triage_category: 'yellow'
  },
  burn: {
    steps: [
      'Cool the burn immediately with cool running water for at least 10 minutes.',
      'Remove any tight items, such as rings or clothing, from the burned area before it swells.',
      'Cover the burn loosely with sterile gauze or a clean cloth. Do not apply ointments.'
    ],
    severity: 'severe',
    triage_category: 'red'
  },
  unconscious: {
    steps: [
      'Check for responsiveness. If no response, call 112 immediately.',
      'Check breathing. If they are not breathing normally, begin CPR (chest compressions).',
      'If breathing normally, place them in the recovery position.'
    ],
    severity: 'critical',
    triage_category: 'black'
  },
  voice: {
    steps: [
      'Ensure the scene is safe. Do not put yourself in danger.',
      'Check the victim\'s airway, breathing, and circulation (ABC).',
      'Call 112, keep the victim calm and still, and do not move them unless necessary.'
    ],
    severity: 'moderate',
    triage_category: 'yellow'
  }
};

function getOfflineFallback(description) {
  const desc = description.toLowerCase();
  let key = 'voice';
  if (desc.includes('bleed') || desc.includes('blood') || desc.includes('cut')) key = 'bleed';
  else if (desc.includes('bone') || desc.includes('fracture') || desc.includes('break')) key = 'bone';
  else if (desc.includes('burn') || desc.includes('fire')) key = 'burn';
  else if (desc.includes('unconscious') || desc.includes('faint') || desc.includes('awake')) key = 'unconscious';
  
  return {
    ...OFFLINE_DICTIONARY[key],
    confidence: 0.99,
    source: 'offline-dictionary',
    latency_ms: 0,
    disclaimer: 'AEGIS Offline Mode. Always seek immediate professional medical help.'
  };
}

/**
 * Standard (blocking) triage request.
 * Sends injury description + optional patient profile to FastAPI → Ollama.
 *
 * @param {string} description — Injury description (3–2000 chars)
 * @param {{ blood_type?: string, allergies?: string[] }} [profile] — Optional medical profile
 * @returns {Promise<TriageResponse>}
 */
export async function fetchTriage(description, profile = null) {
  try {
    const response = await fetch(`${API_BASE}/triage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        ...(profile && { patient_profile: profile }),
      }),
      signal: AbortSignal.timeout(90_000), // 90s — local LLM inference on CPU can be slow
    });

    if (!response.ok) {
      console.warn(`[Triage] Server error (${response.status}) — using offline dictionary`);
      return getOfflineFallback(description);
    }

    const data = await response.json();
    if (!data?.steps || !Array.isArray(data.steps) || data.steps.length === 0) {
      console.warn('[Triage] Malformed response — using offline dictionary');
      return getOfflineFallback(description);
    }

    return data;

  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      console.warn('[Triage] Request timed out — using offline dictionary');
      return getOfflineFallback(description);
    }
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      console.warn('[Triage] Backend unreachable — using offline dictionary');
      return getOfflineFallback(description);
    }
    console.warn('[Triage] Unexpected error — using offline dictionary', err);
    return getOfflineFallback(description);
  }
}

/**
 * Streaming triage via SSE (Server-Sent Events).
 * Emits tokens as they arrive from Ollama, calling onToken for each.
 * Calls onDone with the final parsed result when streaming completes.
 * Calls onError if the stream fails (also emits mock fallback).
 *
 * @param {string} description
 * @param {{ blood_type?: string, allergies?: string } | null} profile
 * @param {{ onToken: (token: string) => void, onDone: (result: object) => void, onError: (err: Error) => void }} handlers
 * @returns {() => void} — cancel function (closes the EventSource)
 */
export function streamTriage(description, profile, { onToken, onDone, onError }) {
  const params = new URLSearchParams({ description, _t: Date.now().toString() });
  if (profile?.blood_type) params.set('blood_type', profile.blood_type);
  if (profile?.allergies) {
    const allergies = Array.isArray(profile.allergies)
      ? profile.allergies
      : String(profile.allergies).split(',').map((item) => item.trim()).filter(Boolean);
    if (allergies.length) params.set('allergies', allergies.join(','));
  }

  const url = `${API_BASE}/triage/stream?${params.toString()}`;
  console.log('[Triage Stream] Initiating connection to:', url);

  // EventSource only supports GET — perfect for our streaming endpoint
  let es;
  try {
    es = new EventSource(url);
    es.onopen = () => console.log('[Triage Stream] EventSource CONNECTED');
  } catch (err) {
    console.error('[Triage Stream] EventSource construction failed:', err);
    onError(new Error('SSE not supported in this browser'));
    onDone(getOfflineFallback(description));
    return () => {};
  }

  const timeoutId = setTimeout(() => {
    es.close();
    console.warn('[Triage Stream] 15s Timed out — signalling onError');
    onError(new Error('Triage request timed out'));
  }, 15_000);

  es.onmessage = (event) => {
    console.log('[Triage Stream] Received message. Length:', event.data?.length, 'Data:', event.data.substring(0, 100));
    try {
      const data = JSON.parse(event.data);
      if (data.error) {
        console.error('[Triage Stream] Backend sent explicit error:', data.message);
        clearTimeout(timeoutId);
        es.close();
        onError(new Error(data.message || 'Backend AI stream failed'));
      } else if (data.done) {
        console.log('[Triage Stream] Stream complete (data.done). Steps:', data.steps?.length);
        clearTimeout(timeoutId);
        es.close();
        onDone({
          steps: data.steps,
          severity: data.severity,
          triage_category: data.triage_category,
          confidence: data.confidence ?? 0.75,
          source: data.source,
          disclaimer: 'AEGIS AI first-aid guidance. Always seek immediate professional medical help.',
          latency_ms: 0,
        });
      } else if (typeof data.token === 'string') {
        console.log('[Triage Stream] Token received. Token length:', data.token.length);
        onToken(data.token);
      } else {
        console.warn('[Triage Stream] Unknown data format:', data);
      }
    } catch (e) {
      console.error('[Triage Stream] JSON parse error:', e, 'Raw string:', event.data);
    }
  };

  let errorHandled = false;
  es.onerror = (e) => {
    console.error('[Triage Stream] SSE connection error (onerror triggered).', e);
    if (errorHandled) return;
    errorHandled = true;
    clearTimeout(timeoutId);
    es.close();
    onError(new Error('EventSource failed'));
  };

  // Return cancel function
  return () => {
    es.close();
  };
}

/**
 * Fetches the current AI model status from the backend.
 * Safe to call on mount — returns null if backend is offline.
 *
 * @returns {Promise<{ active_model: string, ollama_online: boolean, available_models: string[] } | null>}
 */
export async function fetchModelStatus() {
  try {
    const resp = await fetch(`${API_BASE}/model/status`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/**
 * Hot-swaps the active Ollama model at runtime.
 * @param {string} modelName
 * @returns {Promise<{ success: boolean, active_model: string } | null>}
 */
export async function switchModel(modelName) {
  try {
    const resp = await fetch(`${API_BASE}/model/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}
