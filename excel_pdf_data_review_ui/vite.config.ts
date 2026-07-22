import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const appHost = env.APP_HOST || "127.0.0.1";
  const appPort = readPort(env.APP_PORT, 5174);
  const previewPort = readPort(env.APP_PREVIEW_PORT, 4174);
  const apiHost = env.API_HOST || "127.0.0.1";
  const apiPort = readPort(env.API_PORT || env.PORT, 8790);

  return {
    root: import.meta.dirname,
    plugins: [react()],
    server: {
      host: appHost,
      port: appPort,
      strictPort: true,
      proxy: {
        "/api": `http://${apiHost}:${apiPort}`
      }
    },
    preview: {
      host: appHost,
      port: previewPort
    }
  };
});

function readPort(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
}
