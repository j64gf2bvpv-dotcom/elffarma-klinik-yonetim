// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// ../shared/src (DOM-free types/i18n/business-logic reused from the desktop
// app, see shared/README.md) lives outside this project's root — Metro only
// watches/resolves inside projectRoot by default, so it must be added here
// for the "@shared/*" alias (babel.config.js) to actually bundle/hot-reload.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../shared')];

// expo-sqlite (offlineQueue.ts, tüm platformlarda koşulsuz import ediliyor)
// web'de wa-sqlite'ın .wasm dosyasını yükler — Metro varsayılan olarak
// .wasm'ı asset olarak tanımıyor, bu olmadan tüm web bundle'ı 500 ile
// çöküyordu (harita ekranıyla ilgisi yok, offline queue'nun bir yan etkisi).
// COOP/COEP header'ları da wa-sqlite'ın kullandığı SharedArrayBuffer için
// tarayıcı tarafından zorunlu tutuluyor.
config.resolver.assetExts.push('wasm');
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    return middleware(req, res, next);
  },
};

module.exports = config;
