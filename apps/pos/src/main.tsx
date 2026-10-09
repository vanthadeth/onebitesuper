import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/noto-sans-khmer/400.css";
import "@fontsource/noto-sans-khmer/600.css";
import "@onebite/ui/styles.css";
import "@onebite/ui/controls.css";
import { LanguageProvider, registerPwa } from "@onebite/ui";
import { App } from "./App";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>,
);
if (import.meta.env.PROD) registerPwa();
