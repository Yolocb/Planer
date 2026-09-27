// FamilyCal is a client-only static SPA (no backend, all data in IndexedDB).
// Disable SSR + prerendering so every route is served by the SPA fallback
// (200.html) that adapter-static emits.
export const ssr = false;
export const prerender = false;
