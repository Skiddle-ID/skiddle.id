/**
 * The woff2 files a page preloads for each font in the theme's catalogue (src/lib/site-theme.mjs):
 * the same latin 400 and 600 files src/style.css declares. Vite gives each its URL.
 */
import geistMono400 from '@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2?url';
import geistMono600 from '@fontsource/geist-mono/files/geist-mono-latin-600-normal.woff2?url';
import geist400 from '@fontsource/geist/files/geist-latin-400-normal.woff2?url';
import geist600 from '@fontsource/geist/files/geist-latin-600-normal.woff2?url';
import ibmPlexSans400 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2?url';
import ibmPlexSans600 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2?url';
import ibmPlexMono400 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url';
import ibmPlexMono600 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2?url';
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
import jetbrainsMono400 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url';
import jetbrainsMono600 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2?url';
import sourceSerifFour400 from '@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2?url';
import sourceSerifFour600 from '@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff2?url';
import type { FontId } from '~/lib/site-theme.mjs';

export const FONT_FILES: Record<FontId, [string, string]> = {
  'geist-mono': [geistMono400, geistMono600],
  'geist': [geist400, geist600],
  'ibm-plex-sans': [ibmPlexSans400, ibmPlexSans600],
  'ibm-plex-mono': [ibmPlexMono400, ibmPlexMono600],
  'inter': [inter400, inter600],
  'jetbrains-mono': [jetbrainsMono400, jetbrainsMono600],
  'source-serif-4': [sourceSerifFour400, sourceSerifFour600],
};
