import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/* Aparte de `vite.config.ts` a propósito: los tests no necesitan Tailwind —no
   miran estilos— y cargar su plugin sólo agrega trabajo a cada corrida. El
   alias `@` sí se repite, porque sin él los imports del código bajo prueba no
   resuelven. */
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
