import sharp from 'sharp';
import isAnimated from 'is-animated';
import { ImageOptions } from './parseQuery';
import { LoaderOptions } from './options';
import optimizeImage from './optimize';
import convertImage from './convert';
import getDominantColors from './lqip/colors';
import calculateBlurOptions from './lqip/blur';

/**
 * Processes an image by performing all steps specified in the image options
 *
 * @async
 * @param {Buffer} inputImage Input image
 * @param {{ format?: string }} imageInfo Input image metadata
 * @param {ImageOptions} imageOptions Target image options
 * @param {LoaderOptions} loaderOptions Optimized images loader options
 * @returns {{ data: Buffer | string; info: { width?: number; height?: number; format?: string } }} Processed image
 */
const processImage = async (
  inputImage: Buffer,
  imageOptions: ImageOptions,
  loaderOptions: LoaderOptions,
): Promise<{ data: Buffer | string | string[]; info: { width?: number; height?: number; format?: string } }> => {
  // load image
  let image = sharp(inputImage, { animated: true });
  const imageMetadata = await image.metadata();

  const isAnimatedPNG = imageMetadata.format === 'png' && isAnimated(inputImage);
  if (isAnimatedPNG) {
    // eslint-disable-next-line no-console
    console.warn(
      `
      Sharp does not support animated png for now, this issue caused by libspng from upstream. So directly return the original image.
      For more information your can check these relevant issues:
      - APNG support https://github.com/lovell/sharp/issues/2375
      - Animated PNG (APNG) read support https://github.com/randy408/libspng/issues/4
      `,
    );
    return { data: inputImage, info: imageMetadata };
  }

  // rotate image if necessary
  if (imageMetadata.format !== 'svg') {
    image = image.rotate();
  }

  // calculate blur options if lqip is requested
  if (imageOptions.lqip === 'blur') {
    calculateBlurOptions(imageMetadata, imageOptions);
  }

  // resize image
  if (imageOptions.resize) {
    image = image.resize(imageOptions.width, imageOptions.height);

    // fill missing resize values
    if (typeof imageOptions.width !== 'number' || typeof imageOptions.height !== 'number') {
      const { info } = await image.toBuffer({ resolveWithObject: true });

      if (typeof imageOptions.width !== 'number') {
        imageOptions.width = info.width; // eslint-disable-line no-param-reassign
      }

      if (typeof imageOptions.height !== 'number') {
        imageOptions.height = info.height; // eslint-disable-line no-param-reassign
      }
    }
  }

  // get lqip colors
  if (imageOptions.lqip === 'colors') {
    return { data: await getDominantColors(image), info: imageMetadata };
  }

  // convert image
  if (imageOptions.convert) {
    return { data: await convertImage(image, imageOptions.convert, loaderOptions), info: imageMetadata };
  }

  // optimize image
  if (imageMetadata.format && imageOptions.optimize) {
    return {
      data: await optimizeImage(image, inputImage, imageMetadata.format, imageOptions, loaderOptions),
      info: imageMetadata,
    };
  }

  // for svg, return input image if it was not optimized
  if (imageMetadata.format === 'svg') {
    return { data: inputImage, info: imageMetadata };
  }

  // make sure original sizes are served
  if (!imageOptions.resize) {
    return { data: inputImage, info: imageMetadata };
  }

  return { data: await image.toBuffer(), info: imageMetadata };
};

export default processImage;
