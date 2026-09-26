import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";

// Register the production service worker.
// The service worker itself is defined in src/sw.ts
// and bundled by vite-plugin-pwa.
registerSW({
  immediate: true,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);