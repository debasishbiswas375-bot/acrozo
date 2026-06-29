import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Shared proxy config used in both server and preview
  const proxyConfig = {
    "/api": {
      target: `http://127.0.0.1:${env.BACKEND_PORT || 8000}`,
      changeOrigin: true,
      secure: false,
    },
    // MinerU REST API — tiny JSON (get upload URL, poll status)
    "/mineru": {
      target: "https://mineru.net",
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => path.replace(/^\/mineru/, ""),
      configure: (proxy: any) => {
        proxy.on("proxyReq", (proxyReq: any) => {
          proxyReq.setHeader("Origin", "https://mineru.net");
          proxyReq.setHeader("Referer", "https://mineru.net/");
        });
      },
    },
    // Alibaba OSS upload — file bytes proxied to bypass CORS on OSS bucket
    // MinerU CDN result zip download (no CORS headers on this CDN)
    "/cdn-mineru": {
      target: "https://cdn-mineru.openxlab.org.cn",
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => path.replace(/^\/cdn-mineru/, ""),
      configure: (proxy: any) => {
        proxy.on("proxyReq", (proxyReq: any) => {
          proxyReq.setHeader("Host", "cdn-mineru.openxlab.org.cn");
          proxyReq.removeHeader("Authorization");
        });
      },
    },
    "/oss-upload": {
      target: "https://mineru.oss-cn-shanghai.aliyuncs.com",
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => path.replace(/^\/oss-upload/, ""),
      configure: (proxy: any) => {
        proxy.on("proxyReq", (proxyReq: any) => {
          // Must match the hostname the pre-signed URL was signed for
          proxyReq.setHeader("Host", "mineru.oss-cn-shanghai.aliyuncs.com");
          proxyReq.removeHeader("Authorization");
          // OSS pre-signed URLs are signed WITHOUT Content-Type.
          // Sending any Content-Type also breaks the signature.
          proxyReq.removeHeader("Content-Type");
          proxyReq.removeHeader("content-type");
        });
      },
    },
  };

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    server: {
      port: parseInt(env.PORT) || 5173,
      host: true,
      cors: {
        origin: true,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      },
      proxy: proxyConfig,
    },
    preview: {
      port: parseInt(env.PORT) || 5173,
      host: true,
      cors: {
        origin: true,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      },
      proxy: proxyConfig,
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
