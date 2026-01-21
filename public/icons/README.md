# App Icons

To make your PWA installable, you need to add app icons in multiple sizes.

## Required Icon Sizes

- `icon-72x72.png` (72x72 pixels)
- `icon-96x96.png` (96x96 pixels)
- `icon-128x128.png` (128x128 pixels)
- `icon-144x144.png` (144x144 pixels)
- `icon-152x152.png` (152x152 pixels)
- `icon-192x192.png` (192x192 pixels) - **Required minimum**
- `icon-384x384.png` (384x384 pixels)
- `icon-512x512.png` (512x512 pixels) - **Required for Android**

## How to Generate Icons

1. **Create a base icon**: Start with a 512x512px square PNG image (your logo/brand)

2. **Generate all sizes**: Use one of these tools:
   - **Online**: https://realfavicongenerator.net/ or https://www.pwabuilder.com/imageGenerator
   - **Command line**: Use ImageMagick or similar tools to resize
   
3. **Place all icons** in this `public/icons/` folder with the exact names listed above

## Quick Start (if you have a 512x512 icon)

If you already have a `logo.png` at 512x512, you can use ImageMagick to generate all sizes:

```bash
# Install ImageMagick first: brew install imagemagick (on Mac)

cd public/icons
convert logo.png -resize 72x72 icon-72x72.png
convert logo.png -resize 96x96 icon-96x96.png
convert logo.png -resize 128x128 icon-128x128.png
convert logo.png -resize 144x144 icon-144x144.png
convert logo.png -resize 152x152 icon-152x152.png
convert logo.png -resize 192x192 icon-192x192.png
convert logo.png -resize 384x384 icon-384x384.png
cp logo.png icon-512x512.png
```

## Icon Design Tips

- Use a square format
- Keep important elements centered
- Use high contrast colors
- Make it recognizable at small sizes
- Test how it looks on light and dark backgrounds
