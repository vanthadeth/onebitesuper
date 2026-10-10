import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ base: process.env.ONEBITE_BASE_PATH || "/", plugins: [react(), tailwindcss()] });
