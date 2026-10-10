import {cleanSampleData} from "@onebite/offline/cleanup";
import React from "react";
import { createRoot } from "react-dom/client";
import "@onebite/ui/daisy.css";
import "./admin-access.css";
import "@onebite/ui/controls.css";
import "./framework.css";
import "@onebite/ui/polish.css";
import "@onebite/ui/motion.css";
import { InteractionFeedback, LanguageProvider, AppSettingsProvider, registerPwa } from "@onebite/ui";
import { AccessApp } from "./AccessApp";
cleanSampleData();
if(window.top!==window.self){document.getElementById("root")!.textContent="Open OneBite directly to continue.";}else createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppSettingsProvider><LanguageProvider><InteractionFeedback/>
      <AccessApp />
    </LanguageProvider></AppSettingsProvider>
  </React.StrictMode>,
);
if (import.meta.env.PROD) registerPwa();
