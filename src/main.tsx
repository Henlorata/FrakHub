import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import App from "./App";
import "@fontsource-variable/inter";
import "./index.css";

// After a new deployment the previous build's chunks no longer exist, so an open tab
// fails to load the next lazy page. Reload once to pick up the new build.
const RELOAD_KEY = "frakhub:chunk-reload-at";
window.addEventListener("vite:preloadError", (event) => {
  const lastReload = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
  if (Date.now() - lastReload < 10_000) return; // reloaded moments ago: let the error surface
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App/>
  </StrictMode>,
);
