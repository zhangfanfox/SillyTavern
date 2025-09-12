// Metro config for Expo that limits watchers to the mobile folder and excludes heavy sibling folders.
const path = require('path');
const { getDefaultConfig } = require('@expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const defaultConfig = getDefaultConfig(projectRoot);

function escapeForRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const blockedDirs = [
  'data',
  'backups',
  'default',
  'public',
  'docker',
  'colab',
  'tests',
  'src/electron',
  'src/server-',
].map((p) => path.join(workspaceRoot, p));

const blockList = new RegExp(
  `^(${blockedDirs.map((p) => escapeForRegExp(p)).join('|')})/.*`
);

module.exports = {
  ...defaultConfig,
  watchFolders: [projectRoot],
  resolver: {
    ...defaultConfig.resolver,
    blockList,
  },
};
