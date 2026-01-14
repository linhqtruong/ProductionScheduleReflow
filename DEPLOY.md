# Deployment Guide

This guide explains how to deploy the Production Schedule Reflow System to a web server.

## Deployment Package

The deployment package is located in the **`dist/`** directory. This directory contains all the files needed to deploy the application.

### Package Contents

After running `npm run build`, the `dist/` directory contains:
```
dist/
├── index.html              # Main HTML file
├── .htaccess              # Apache server configuration (optional)
└── assets/
    ├── index-[hash].js    # Optimized JavaScript bundle (~451 KB)
    └── index-[hash].css   # Optimized CSS bundle (~20 KB)
```

**Total Size:** ~472 KB (uncompressed), ~148 KB (gzipped)

## Quick Deployment Steps

### 1. Build the Production Version

If not already built, run:
```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### 2. Upload Files to Your Web Server

Upload **ALL files and folders** from the `dist/` directory to your web server's root directory (or the directory where you want the app to be accessible).

**Important:**
- Upload the entire `dist/` folder contents (not the `dist/` folder itself)
- Include the `assets/` folder with all its contents
- Include the `.htaccess` file (if using Apache)
- Maintain the folder structure

### 3. Server Configuration

#### Apache Server (Most Common)

The `dist/.htaccess` file is already included and handles:
- Routing all requests to `index.html` (SPA routing)
- Gzip compression
- Browser caching for static assets

Make sure your Apache server has `mod_rewrite` enabled.

**To enable mod_rewrite on Apache:**
```bash
# Ubuntu/Debian
sudo a2enmod rewrite
sudo systemctl restart apache2

# Or add to your Apache config:
LoadModule rewrite_module modules/mod_rewrite.so
```

#### Nginx Server

If using Nginx, add this configuration to your server block:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

#### Other Static Hosting Services

**Vercel:**
```bash
npm i -g vercel
vercel --prod
```

**Netlify:**
- Drag and drop the `dist/` folder to Netlify, or
- Use Netlify CLI: `netlify deploy --prod --dir=dist`

**GitHub Pages:**
1. Install: `npm install --save-dev gh-pages`
2. Add to `package.json`: `"deploy": "npm run build && gh-pages -d dist"`
3. Run: `npm run deploy`

### 4. File Permissions

Ensure correct file permissions:
- **Files:** 644 (readable by all, writable by owner)
- **Directories:** 755 (executable by all, writable by owner)

```bash
# Set permissions (Unix/Linux)
find dist -type f -exec chmod 644 {} \;
find dist -type d -exec chmod 755 {} \;
```

### 5. Verification

After deployment, verify:
1. ✅ The app loads at your domain
2. ✅ JSON input field displays with default data (scenario-4-edge-cases.json)
3. ✅ "Run Reflow" button works
4. ✅ Gantt chart renders correctly
5. ✅ DAG visualization works
6. ✅ No console errors in browser developer tools

## Deployment Checklist

- [ ] Built production version (`npm run build`)
- [ ] Verified `dist/` folder contains all files
- [ ] Uploaded all files from `dist/` to web server
- [ ] Configured server for SPA routing (if needed)
- [ ] Set correct file permissions
- [ ] Tested the deployed application
- [ ] Verified all features work correctly

## Troubleshooting

### Issue: 404 Error on Page Refresh

**Problem:** The server returns 404 for routes other than `/`

**Solution:** Configure your server to serve `index.html` for all routes. See Server Configuration section above.

### Issue: Assets Not Loading (404 for JS/CSS files)

**Problem:** Browser can't find JavaScript or CSS files

**Solutions:**
- Verify all files in `dist/assets/` are uploaded
- Check file paths in browser console (Network tab)
- Ensure the `assets/` folder structure is maintained
- Check file permissions (should be 644)

### Issue: Blank Page / JavaScript Errors

**Problem:** The app doesn't load or shows errors

**Solutions:**
- Open browser console (F12) and check for errors
- Verify all files uploaded correctly
- Check that `index.html` is in the root directory
- Ensure JavaScript files are accessible (check Network tab)
- Verify server supports correct MIME types

### Issue: CORS Errors

**Problem:** Cross-Origin Resource Sharing errors

**Solution:** This app doesn't make external API calls, so CORS shouldn't be an issue. If you see CORS errors, check your server configuration or browser console for details.

## Production Build Information

- **Build Tool:** Vite
- **JavaScript Bundle:** ~451 KB (143 KB gzipped)
- **CSS Bundle:** ~20 KB (5 KB gzipped)
- **Total Size:** ~472 KB (148 KB gzipped)
- **Format:** Optimized and minified for production
- **Browser Support:** Modern browsers (ES2020+)

## Notes

- ✅ **No Backend Required:** The app runs entirely in the browser
- ✅ **No Database Required:** All processing is client-side
- ✅ **Static Files Only:** Just upload the `dist/` folder contents
- ✅ **Sample Data Included:** Default scenario (scenario-4-edge-cases.json) is bundled
- ✅ **Single Page Application:** Requires server configuration for client-side routing

## Support

For issues or questions about deployment:
1. Check browser console for errors (F12)
2. Verify all files are uploaded correctly
3. Check server logs for errors
4. Review server configuration

## Additional Resources

- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [React Router Deployment](https://reactrouter.com/en/main/start/overview#deployment)
- Your web hosting provider's documentation for static file hosting
