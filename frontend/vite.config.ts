import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const design = fileURLToPath(new URL("../design/components", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@design": design },
    // design/ 는 frontend 밖에 있어서, react를 frontend/node_modules 하나에서만 찾게 한다
    dedupe: ["react", "react-dom"],
  },
  server: {
    fs: { allow: [".."] },
    proxy: { "/api": "http://localhost:8000" }, // 로컬: 백엔드로 전달
  },
  preview: { proxy: { "/api": "http://localhost:8000" } },
});
