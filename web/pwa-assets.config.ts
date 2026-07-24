import { defineConfig } from '@vite-pwa/assets-generator/config';

// Local-only PWA icon generation (`npm run generate-pwa-assets`). NOT part of the
// Vercel build — only the generated PNGs under public/icons are committed & served.
//
// Source is the opaque full-bleed icon-source.svg; every variant gets a #1a1a1a
// background so the maskable/apple icons are full-bleed dark (no transparent
// corners masking through). The scalable rounded icon.svg is referenced directly
// for the SVG manifest + favicon entries and is not generated here.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  images: ['public/icons/icon-source.svg'],
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[64, 'favicon.ico']],
      padding: 0.05,
      resizeOptions: { fit: 'contain', background: '#1a1a1a' },
    },
    maskable: {
      sizes: [512],
      padding: 0.1,
      resizeOptions: { fit: 'contain', background: '#1a1a1a' },
    },
    apple: {
      sizes: [180],
      padding: 0.1,
      resizeOptions: { fit: 'contain', background: '#1a1a1a' },
    },
  },
});
