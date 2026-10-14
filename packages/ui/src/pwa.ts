export function registerPwa() {
  if (!("serviceWorker" in navigator) || location.hostname.endsWith(".local")) return;
  const register = async () => {
    // Retire only the old shared OneBite worker on repository hosting.
    // App-specific workers and offline databases remain untouched.
    const base = new URL(import.meta.env.BASE_URL, location.origin);
    if (/\/(pos|admin|inventory)\/$/.test(base.pathname)) {
      const parent = new URL("../", base);
      try {
        for (const registration of await navigator.serviceWorker.getRegistrations()) {
          const worker = registration.active || registration.waiting || registration.installing;
          if (registration.scope === parent.href && worker?.scriptURL === new URL("sw.js", parent).href) {
            await registration.unregister();
          }
        }
      } catch { /* Installation remains available if legacy cleanup fails. */ }
    }
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      // Launch metadata must be checked on every visit, even with an old worker.
      updateViaCache: "none",
    }).then(registration => registration.update()).catch(() => {
      /* Offline launches continue using the existing worker. */
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, {once:true});
}
