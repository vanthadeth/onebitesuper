import React from "react";
import { createRoot } from "react-dom/client";
import "@onebite/ui/daisy.css";
import "@onebite/ui/styles.css";
import "@onebite/ui/controls.css";
import "@onebite/ui/polish.css";
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
