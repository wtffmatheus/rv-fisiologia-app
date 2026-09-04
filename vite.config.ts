import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildTime = new Date().toISOString()

export default defineConfig({
  plugins: [react()],
  define: {
    __RV_BUILD_AT__: JSON.stringify(buildTime),
  },
})
