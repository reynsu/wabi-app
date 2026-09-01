import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  /* De dónde cuelgan los assets. En GitHub Pages el sitio no vive en la raíz de
     un dominio sino en `/wabi-app/`, así que un `/assets/index.js` absoluto
     —el default de Vite— apunta a un lugar que no existe y la página sale en
     blanco sin decir por qué.
     `base` se aplica sólo al build: `vite dev` sigue sirviendo en `/`. */
  base: process.env.GITHUB_PAGES ? "/wabi-app/" : "/",
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
