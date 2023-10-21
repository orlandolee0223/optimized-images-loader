import path from 'path';
import os from 'os';
import { promises as fs, constants } from 'fs';
import querystring from 'querystring';
import { getHashDigest } from 'loader-utils';
import { ImageOptions } from './parseQuery';
import { LoaderOptions } from './options';
import { getLoaderVersion } from './util';

/**
 * Checks if the given cache folder is valid and writable
 *
 * @async
 * @param {string} cacheFolder Cache folder
 * @returns {boolean} Whether the cache folder is valid
 */
const isValidCacheFolder = async (cacheFolder: string): Promise<boolean> => {
  // try accessing the parent folder
  try {
    await fs.access(path.dirname(cacheFolder));
  } catch {
    return false;
  }

  // check if the folder already exists
  try {
    await fs.access(cacheFolder, constants.W_OK);
    return true;
  } catch {
    // otherwise try to create the cache folder
    try {
      await fs.mkdir(cacheFolder);
      return true;
    } catch (e) {
      return e.code === 'EEXIST';
    }
  }
};

/**
 * Determines the correct cache folder to use
 *
 * @async
 * @param {LoaderOptions} loaderOptions Optimized images loader options
 * @returns {string} Cache folder path
 */
const getCacheFolder = async (loaderOptions: LoaderOptions): Promise<string> => {
  let cacheFolder = loaderOptions.cacheFolder || path.resolve(__dirname, '..', '.cache');

  if (await isValidCacheFolder(cacheFolder)) {
    return cacheFolder;
  }

  if (!loaderOptions.cacheFolder) {
    cacheFolder = path.resolve(os.tmpdir(), 'next-optimized-images-loader');

    if (await isValidCacheFolder(cacheFolder)) {
      return cacheFolder;
    }
  }

  throw new Error(`Cache folder ${cacheFolder} is not writable or parent folder does not exist`);
};

/**
 * Calculates a hash for the given image and query string
 *
 * @param {Buffer} source Source image
 * @param {ImageOptions} imageOptions Image options
 * @returns {string} Hash
 */
export const getHash = (source: Buffer, imageOptions: ImageOptions): string => {
  const query = querystring.stringify(imageOptions as any); // eslint-disable-line

  return `${(getHashDigest as (input: Buffer) => string)(source)}-${(getHashDigest as (input: Buffer) => string)(
    Buffer.from(query),
  )}`;
};

/**
 * Retrieves an optimized image from cache if it exists
 *
 * @async
 * @param {string} hash Cache hash
 * @param {LoaderOptions} loaderOptions Optimized images loader options
 * @returns {{ data: Buffer | string | string[]; info: { width?: number; height?: number; format?: string }, imageOptions: ImageOptions } | null} Cached image or null if not present
 */
export const getCache = async (
  hash: string,
  loaderOptions: LoaderOptions,
): Promise<{
  data: Buffer | string | string[];
  info: { width?: number; height?: number; format?: string };
  imageOptions: ImageOptions;
} | null> => {
  const cacheFolder = await getCacheFolder(loaderOptions);

  try {
    const options = JSON.parse((await fs.readFile(path.resolve(cacheFolder, `${hash}.json`))).toString());

    // make sure the cache file was created for the current version
    if (options.version !== (await getLoaderVersion())) {
      return null;
    }

    const data = await fs.readFile(path.resolve(cacheFolder, hash));

    if (options.isBuffer) {
      return { data, info: options.info, imageOptions: options.imageOptions };
    }

    return { data: JSON.parse(data.toString()), info: options.info, imageOptions: options.imageOptions };
  } catch {
    return null;
  }
};

/**
 * Writes an optimized image into the cache
 *
 * @async
 * @param {string} hash Cache hash
 * @param {Buffer | string | string[]} result Optimized image
 * @param {{ width?: number; height?: number; format?: string }} info Image information
 * @param {ImageOptions} imageOptions Image options
 * @param {LoaderOptions} loaderOptions Optimized images loader options
 */
export const setCache = async (
  hash: string,
  result: Buffer | string | string[],
  { width, height, format }: { width?: number; height?: number; format?: string },
  imageOptions: ImageOptions,
  loaderOptions: LoaderOptions,
): Promise<void> => {
  const cacheFolder = await getCacheFolder(loaderOptions);

  if (Buffer.isBuffer(result)) {
    await fs.writeFile(path.resolve(cacheFolder, hash), result);
  } else {
    await fs.writeFile(path.resolve(cacheFolder, hash), JSON.stringify(result));
  }

  await fs.writeFile(
    path.resolve(cacheFolder, `${hash}.json`),
    JSON.stringify({
      imageOptions,
      info: { width, height, format },
      isBuffer: Buffer.isBuffer(result),
      version: await getLoaderVersion(),
    }),
  );
};
