export function registerPwa() {
  if ("serviceWorker" in navigator && !location.hostname.endsWith(".local"))
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Dev servers have no generated service worker. */
      });
    });
}
