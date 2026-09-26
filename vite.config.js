import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            strategies: "injectManifest",
            srcDir: "src",
            filename: "sw.ts",
            injectManifest: {
                // App shell only. Financial writes are NEVER queued offline in
                // Phase 1-3 - see src/sw.ts. Export libraries (ExcelJS/jsPDF) are
                // dynamically imported at call time (see ExportMenu.tsx) specifically
                // so they stay out of this precache.
                maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
            },
            registerType: "autoUpdate",
            includeAssets: ["icons/*.png"],
            manifest: {
                name: "KED Finance",
                short_name: "KED Finance",
                description: "Personal finance & income-allocation app",
                theme_color: "#0A0A0A",
                background_color: "#FAF8F5",
                display: "standalone",
                start_url: "/dashboard",
                icons: [
                    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
                    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
                    {
                        src: "/icons/icon-512-maskable.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
    },
});
