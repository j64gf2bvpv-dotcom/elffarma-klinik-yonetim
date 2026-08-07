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

module.exports = config;
