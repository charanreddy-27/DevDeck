import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

// Flat config replaces `next lint`, which Next.js 16 removed. The Next preset
// already bundles the react, react-hooks, jsx-a11y and import plugins.
export default defineConfig([
  ...nextVitals,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'node_modules/**', 'next-env.d.ts']),
]);
