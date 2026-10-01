(function registerGomokuPwa() {
  "use strict";

  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./" })
      .then((registration) => {
        registration.update();
      })
      .catch((error) => {
        console.info("PWA service worker registration skipped:", error);
      });
  });
})();
