import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
if (!process.env.KOOTA_ENTRY) throw new Error('Set KOOTA_ENTRY to a built Koota dist/index.js.');
export const K = await import(pathToFileURL(resolve(process.env.KOOTA_ENTRY)).href);
