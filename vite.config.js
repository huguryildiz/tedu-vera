import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["qr-code-styling"],
  },
  // Vercel deploy runs at the domain root. Using a subpath base causes /assets/* 404s.
  base: '/',
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    pool: 'vmForks',
    exclude: ['**/node_modules/**', '**/e2e/**', '**/__tests__.archive/**', '**/sql/__tests__.archive/**', '**/*.archive.*', '**/supabase/functions/**', '**/sql/tests/**'],
    watchExclude: ['**/e2e/**', '**/__tests__.archive/**', '**/supabase/functions/**', '**/sql/tests/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/test/**', 'src/**/__tests__.archive/**', 'src/main.jsx', 'src/router.jsx'],
      thresholds: {
        // Ratcheted 2026-04-25 from 47/32/56/47 to lock in P0+P1 gains.
        // Actual measured at this commit: 54.92/38.44/58.88/54.92. Targets
        // sit ~2 pts below measured for flake margin; raise to audit's
        // 60/50/65 stretch goal once subsequent sprints add more tests.
        lines: 53,
        functions: 37,
        branches: 57,
        statements: 53,
        'src/shared/hooks/**': { lines: 70, functions: 50, branches: 70, statements: 70 },
        'src/shared/storage/**': { lines: 80, functions: 65, branches: 50, statements: 80 },
        'src/shared/lib/**': { lines: 55, functions: 70, branches: 75, statements: 55 },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          xlsx: ['xlsx-js-style'],
        },
      },
    },
  },
})
