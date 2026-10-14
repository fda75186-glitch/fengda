import { onBeforeUnmount, onMounted, ref } from 'vue';
import { observatories, observatoryRevision } from './observatories.js';

export const mapApiBase = new URL(import.meta.env.VITE_COMMUNITY_API_URL || '/', window.location.origin).origin;
const apiUrl = path => new URL(path, mapApiBase).href;

function validateCatalogue(data) {
  if (!data || typeof data.revision !== 'string' || !Array.isArray(data.places) || !data.places.length || data.places.length > 100) throw new Error('Invalid catalogue');
  const ids = new Set();
  for (const place of data.places) {
    if (typeof place.id !== 'string' || ids.has(place.id) || typeof place.name !== 'string' || !Number.isFinite(place.longitude) || !Number.isFinite(place.latitude) || place.longitude < 70 || place.longitude > 140 || place.latitude < 10 || place.latitude > 60 || !Number.isFinite(place.zoom) || place.zoom < 3 || place.zoom > 18 || !Array.isArray(place.history) || !Array.isArray(place.sections)) throw new Error('Invalid place');
    ids.add(place.id);
    for (const link of [place.url, place.sourceUrl, ...place.sources.map(source => source.url)]) if (new URL(link).protocol !== 'https:') throw new Error('Invalid source URL');
  }
  return data;
}

export function useObservatories() {
  const places = ref(observatories), status = ref('connecting'), revision = ref(observatoryRevision);
  let events, controller, disposed = false;
  function apply(data) {
    const validated = validateCatalogue(data);
    if (validated.revision !== revision.value) places.value = validated.places;
    revision.value = validated.revision; status.value = 'shared';
  }
  async function connect() {
    if (disposed) return;
    events?.close(); controller?.abort();
    status.value = 'connecting'; controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(apiUrl('/api/observatories'), { signal: controller.signal });
      if (!response.ok) throw new Error('Catalogue unavailable');
      apply(await response.json());
      if (disposed) return;
      events = new EventSource(apiUrl('/api/observatories/events'));
      events.addEventListener('catalogue', event => { try { apply(JSON.parse(event.data)); } catch { status.value = 'fallback'; } });
      events.onerror = () => { if (!disposed) status.value = 'reconnecting'; };
      events.onopen = () => { if (!disposed) status.value = 'shared'; };
    } catch { if (!disposed) status.value = 'fallback'; }
    finally { clearTimeout(timer); }
  }
  const onOnline = () => { void connect(); };
  const onOffline = () => { events?.close(); controller?.abort(); status.value = 'fallback'; };
  onMounted(() => { void connect(); window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); });
  onBeforeUnmount(() => { disposed = true; events?.close(); controller?.abort(); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); });
  return { places, status, revision, reconnect: connect };
}
