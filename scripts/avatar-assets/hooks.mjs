import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Lets Node run the app's TypeScript as-is: extensionless relative imports resolve to `.ts`,
 * and the React Native-only motion module is swapped for a stub holding the one helper we need.
 */
export async function resolve(specifier, context, next) {
  if (context.parentURL && /(^|\/)motion$/.test(specifier) && specifier.startsWith('.')) {
    return next(new URL('./motion-stub.ts', import.meta.url).href, context);
  }
  if (context.parentURL && specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      const url = new URL(specifier + ext, context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
  }
  return next(specifier, context);
}
