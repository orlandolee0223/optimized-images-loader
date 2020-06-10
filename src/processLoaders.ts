import urlLoader from 'url-loader';
import { loader } from 'webpack';
import { OptionObject } from 'loader-utils';
import { ImageOptions } from './parseQuery';
import { defaultFurtherLoaderOptions } from './options';

/**
 * Enrich previous loader result with new information
 *
 * @param {string | string[]} result Previous loader result
 * @param {{ width?: number; height?: number }} originalImageInfo Metadata of original image
 * @param {ImageOptions} imageOptions Image options
 * @returns {string} Enriched result
 */
const enrichResult = (
  result: string | string[],
  originalImageInfo: { width?: number; height?: number },
  imageOptions: ImageOptions,
): string => {
  const width = imageOptions.resize ? imageOptions.width : originalImageInfo.width;
  const height = imageOptions.resize ? imageOptions.height : originalImageInfo.height;

  // an array means it was not processed by the url-/file-loader and the result should still be an array
  // instead of a string. so in this case, append the additional export information to the array prototype
  if (Array.isArray(result)) {
    return `var res = ${JSON.stringify(result)};res.width=${width};res.height=${height};module.exports = res;`;
  }

  if (result.indexOf('module.exports') < 0) {
    throw new Error('Unexpected input');
  }

  const output = result.replace(/((module\.exports\s*=)\s*)([^\s].*[^;])(;$|$)/g, 'var src = $3;');

  return `${output}module.exports = {src:src,width:${width},height:${height},toString:function(){return src;}};`;
};

/**
 * Process further loaders (url-loader & file-loader)
 *
 * @param {loader.LoaderContext} context Optimized images loader context
 * @param {Buffer | string} image Processed image
 * @param {{ width?: number; height?: number }} originalImageInfo Metadata of original image
 * @param {ImageOptions} imageOptions Image options
 * @param {OptionObject} loaderOptions Options for further loaders
 * @returns {string} Processed loader output
 */
const processLoaders = (
  context: loader.LoaderContext,
  image: Buffer | string | string[],
  originalImageInfo: { width?: number; height?: number },
  imageOptions: ImageOptions,
  loaderOptions: OptionObject,
): string => {
  // do not apply further loaders if not needed
  if (imageOptions.processLoaders === false) {
    if (Array.isArray(image)) {
      return enrichResult(image, originalImageInfo, imageOptions);
    }

    const output = Buffer.isBuffer(image) ? image.toString() : image;

    return enrichResult(`module.exports = ${JSON.stringify(output)}`, originalImageInfo, imageOptions);
  }

  // create options for further loaders (url-loader & file-loader)
  const furtherLoaderOptions = {
    ...defaultFurtherLoaderOptions,
    ...loaderOptions,
    esModule: false,
  } as OptionObject;

  // change extension for converted images
  if (imageOptions.convert && furtherLoaderOptions.name) {
    furtherLoaderOptions.name =
      furtherLoaderOptions.name.indexOf('[ext]') >= 0
        ? furtherLoaderOptions.name.replace('[ext]', imageOptions.convert)
        : (furtherLoaderOptions.name += `.${imageOptions.convert}`);
  }

  // force inlining
  if (imageOptions.forceInline) {
    furtherLoaderOptions.limit = undefined;

    // force url
  } else if (imageOptions.forceUrl) {
    furtherLoaderOptions.limit = -1;
  }

  // build new loader context
  const furtherLoaderContext = { ...context, query: furtherLoaderOptions };

  // get result of url-loader
  const result = urlLoader.call(furtherLoaderContext, image);

  return enrichResult(result, originalImageInfo, imageOptions);
};

export default processLoaders;