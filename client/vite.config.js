import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    https: {
      key: "../private.key",
      cert: "../voice-record-chat.crt",
    },
  },
  plugins: [
    react()
  ],
});
