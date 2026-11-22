/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Scope to the code that actually has behavior worth covering — not
      // .astro pages/layouts, static data, or type-only files.
      include: ['src/lib/ordering/**/*.ts', 'src/components/order/**/*.tsx'],
      exclude: ['src/lib/ordering/types.ts', 'src/lib/ordering/client.ts'],
    },
  },
});
