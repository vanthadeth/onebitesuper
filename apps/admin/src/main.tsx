import React from "react";
import { createRoot } from "react-dom/client";
import "./admin-access.css";
import "@onebite/ui/controls.css";
import "./framework.css";
import { LanguageProvider, registerPwa } from "@onebite/ui";
import { AccessApp } from "./AccessApp";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <AccessApp />
    </LanguageProvider>
  </React.StrictMode>,
);
if (import.meta.env.PROD) registerPwa();
