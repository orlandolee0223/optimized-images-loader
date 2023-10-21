// import { EncodeOptions as MozjpegOptions } from '@wasm-codecs/mozjpeg/lib/types';
// import { EncodeOptions as OxipngOptions } from '@wasm-codecs/oxipng/lib/types';
// import { EncodeOptions as GifsicleOptions } from '@wasm-codecs/gifsicle/lib/types';
import { WebpOptions, JpegOptions, PngOptions, GifOptions } from 'sharp';

export interface LoaderOptions {
  optimize?: boolean;
  cacheFolder?: string;
  includeStrategy?: 'string' | 'react';
  mozjpeg?: JpegOptions;
  oxipng?: PngOptions;
  webp?: WebpOptions;
  gifsicle?: GifOptions;
  svgo?: Record<string, unknown>;
  svgr?: Record<string, unknown>;
}

export interface OptionObject {
  [key: string]: any; // eslint-disable-line
}

// default options for file- & url-loader
export const defaultFurtherLoaderOptions = {
  name: '[name]-[contenthash].[ext]',
  limit: 8192,
};
