import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { applySavedTheme, watchSystemTheme } from "./lib/theme";
import "./styles.css";

// Keep the installed app up to date without prompting the user.
registerSW({ immediate: true });

// Apply the saved (or system) theme before first paint, and keep following the
// device until the user picks a theme explicitly.
applySavedTheme();
watchSystemTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
