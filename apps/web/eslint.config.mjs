import baseConfig from '../../eslint.config.mjs';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...baseConfig,
  { ...nextPlugin.configs['core-web-vitals'], files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'] },
  { ...reactHooks.configs.flat.recommended, files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'] },
];
