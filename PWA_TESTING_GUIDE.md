# PWA Testing Guide

## 🚀 Build and Test Steps

### 1. **Development Mode** (Quick Testing)

For local development testing:

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.

**Note:** PWA service worker is **disabled in development mode** for faster development. To test full PWA features, use production build (see below).

### 2. **Production Build** (Full PWA Testing)

Build the production version:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

Then open `http://localhost:3000` in your browser.

### 3. **Test PWA Installation**

#### **On Desktop (Chrome/Edge):**
1. Open your site in Chrome/Edge
2. Look for the install icon (⊕) in the address bar
3. Or wait for the install prompt banner to appear (bottom-right)
4. Click "Install" to add to desktop

#### **On Android:**
1. Open your site in Chrome
2. Tap the menu (3 dots) → "Add to Home screen" or "Install app"
3. Or wait for the install prompt banner
4. Confirm installation

#### **On iOS (Safari):**
1. Open your site in Safari
2. Tap the Share button (⬆️)
3. Scroll down and tap "Add to Home Screen"
4. Customize the name if needed
5. Tap "Add"

### 4. **Check PWA Status**

#### **In Chrome DevTools:**
1. Open DevTools (F12 or Cmd+Option+I)
2. Go to **Application** tab
3. Check:
   - **Manifest**: Should show your app details and icons
   - **Service Workers**: Should show registered worker (in production build)
   - **Storage**: Check if app is cached

#### **Test Offline:**
1. Open DevTools → **Network** tab
2. Check "Offline" checkbox
3. Refresh page - should still work (if service worker is active)

### 5. **Verify Installation**

After installing:
- App should appear on home screen/desktop
- Should open in standalone window (no browser UI)
- Should have your app name and icon

## ⚠️ Important Notes

### **Icons Required**
Before deploying to production, you **must** add icon files to `public/icons/`:
- Minimum required: `icon-192x192.png` and `icon-512x512.png`
- Recommended: All sizes listed in `public/icons/README.md`

Without icons, installation may fail on some devices.

### **HTTPS Required**
PWAs require HTTPS in production (localhost is exempt). Make sure your production deployment uses HTTPS.

### **Testing Checklist**
- [ ] Manifest loads correctly (check DevTools → Application → Manifest)
- [ ] Service worker registers (production build only)
- [ ] Install prompt appears (on supported browsers)
- [ ] App installs successfully
- [ ] App opens in standalone mode
- [ ] App icon displays correctly
- [ ] Theme color matches your brand
- [ ] Offline functionality works (if implemented)

## 🐛 Troubleshooting

### Install prompt not showing?
- Make sure you're on HTTPS (or localhost)
- Check if browser supports PWA installation
- Check DevTools Console for errors
- Verify manifest.json is accessible

### Icons not displaying?
- Ensure icon files exist in `public/icons/`
- Check icon paths in manifest.json match actual files
- Verify icons are valid PNG files

### Service worker not registering?
- Make sure you're using production build (`npm run build && npm start`)
- Check if service worker file exists in `public/` folder
- Look for errors in DevTools → Application → Service Workers
