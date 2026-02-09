#!/usr/bin/env node

/**
 * PWA Icon Generator
 * Generates placeholder icons for the PWA
 * Run: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Create a simple PNG using base64 (1x1 purple pixel as placeholder)
const purplePixel = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
  0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x6b, 0xb3, 0x37, 0xbb, 0x00, 0x00, 0x00,
  0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);

console.log('🎨 PWA Icon Generator');
console.log('⚠️  NOTE: These are placeholder icons.\n');
console.log('For production, replace with actual icons:');
console.log('  📱 icon-192.png (192x192 pixels)');
console.log('  📱 icon-512.png (512x512 pixels)');
console.log('  📱 icon-192-maskable.png (192x192 pixels, maskable)');
console.log('  📱 icon-512-maskable.png (512x512 pixels, maskable)\n');

console.log('📌 You can generate icons at:');
console.log('  • https://www.favicon-generator.org/');
console.log('  • https://pwa-asset-generator.netlify.app/\n');

console.log('For now, using 1x1 placeholder icons.');
console.log('App will still work, but won\'t display properly on home screen.\n');

const publicDir = path.join(__dirname, 'public');

// Create placeholder icons
const icons = ['icon-192.png', 'icon-512.png', 'icon-192-maskable.png', 'icon-512-maskable.png'];

icons.forEach((icon) => {
  const iconPath = path.join(publicDir, icon);
  fs.writeFileSync(iconPath, purplePixel);
  console.log(`✅ Created ${icon}`);
});

console.log('\n🎉 Placeholder icons created!');
console.log('\n⚡ NEXT STEPS:');
console.log('1. For production, generate real icons (192x512 PNG files)');
console.log('2. Replace the placeholder files in /public/');
console.log('3. Restart the server');
