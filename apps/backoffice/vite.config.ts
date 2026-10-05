import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const apiTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8787";
const srcDir = resolve(import.meta.dirname, "src");

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": srcDir,
		},
	},
	server: {
		port: 5173,
		proxy: {
			"/auth": { target: apiTarget, changeOrigin: true },
			"/staff": { target: apiTarget, changeOrigin: true },
		},
	},
});
