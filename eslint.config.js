// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Keeps imports flowing one way through the sound system; see src/sound/README.md.
const restrict = (group, message) => ({ 'no-restricted-imports': ['error', { patterns: [{ group, message }] }] });

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['src/sound/**'],
    rules: restrict(['**/sound/*'], "Import from 'src/sound', not a file inside it."),
  },
  {
    files: ['src/sound/library/**'],
    rules: restrict(['**/core/*', '**/channels/**', '**/init', '**/sound'], 'library/ is plain data: it imports nothing else in src/sound.'),
  },
  {
    files: ['src/sound/core/**'],
    rules: restrict(['**/library/*', '**/channels/**', '**/init', '**/sound'], 'core/ is shared by every channel; it imports neither library/ nor channels/.'),
  },
  {
    files: ['src/sound/*.ts', 'src/sound/channels/**'],
    rules: restrict(['**/host/*'], "Import the Hat from 'channels/host', not a file inside it."),
  },
]);
