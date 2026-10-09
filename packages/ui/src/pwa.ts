export function registerPwa() {
  if ("serviceWorker" in navigator && !location.hostname.endsWith(".local"))
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
        /* Dev servers have no generated service worker. */
      });
    });
}
