import { pathToFileURL } from 'node:url';
import { getInterpretedFile } from '#storybook-common-original';

export * from '#storybook-common-original';

// This module is mapped only inside Jest. Keep Storybook's normal exports and
// candidate resolution, but import configs through Jest's sandbox and transform
// instead of Storybook's process-wide module.register() TypeScript loader.
export async function serverRequire(filePath) {
  const paths = Array.isArray(filePath) ? filePath : [filePath];
  for (const path of paths) {
    const candidate = getInterpretedFile(path);
    if (candidate) {
      const module = await import(pathToFileURL(candidate).href);
      return module.default ?? module;
    }
  }
  return null;
}
