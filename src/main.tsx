import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import App from "./App";
import {installErrorReporting} from "./lib/error-reporting";
import {installChunkReload} from "./lib/lazy";
import {installDisplayMode} from "./lib/display-mode";
import "@fontsource-variable/inter";
import "./index.css";

// Errors nothing caught go to the error log (statistics page).
installErrorReporting();

// Phones and tablets draw the light version (no frosted blur, still backdrop), before the first paint.
installDisplayMode();

// After a new deployment the previous build's chunks no longer exist, so an open tab
// fails to load the next lazy page. Reload once to pick up the new build.
installChunkReload();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App/>
  </StrictMode>,
);
