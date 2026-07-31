import { defineConfig } from 'vite'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'

const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8')) as { version: string }

// Electron's native `electron` binding does not interop reliably with
// Node's ESM loader for the main-process entry point (named *and* default
// imports both resolve to an empty/undefined module in this Electron/Node
// combination) — so main/preload are force-built as CommonJS (.cjs),
// which is the long-standing, reliable way `require('electron')` works.
// Note: this Vite version bundles with Rolldown, whose build option is
// `rolldownOptions` (not the classic Rollup `rollupOptions`) — the plugin's
// own preload default (which already works) uses this same key.
function cjsOutput(input: string) {
  return {
    build: {
      rolldownOptions: {
        // Using `input` directly (instead of the `entry` shortcut, which
        // maps to `build.lib.entry` and forces `formats: ['es']` whenever
        // package.json has `"type": "module"`, silently overriding any
        // `output.format` override) is what makes the CJS override below
        // actually take effect — this mirrors how preload is configured.
        input,
        output: {
          format: 'cjs' as const,
          entryFileNames: '[name].cjs',
        },
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        vite: cjsOutput(path.join(__dirname, 'electron/main.ts')),
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: cjsOutput(path.join(__dirname, 'electron/preload.ts')),
      },
      renderer: {},
    }),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
