import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Listen on the LAN so a phone on the same Wi-Fi can open the real site at
  // http://<mac-ip>:5173 (a phone's own `localhost` never reaches the Mac).
  server: { host: true },
})
