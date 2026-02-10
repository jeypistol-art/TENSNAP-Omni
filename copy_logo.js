const fs = require('fs');
const path = require('path');

const src = 'C:/Users/use/.gemini/antigravity/brain/6f4baf8d-2619-4431-8ff3-fb334d0b1c94/uploaded_media_0_1770084159724.png';
const destDir = 'public/images';
const dest = path.join(destDir, 'logo.png');

console.log('Starting copy operation...');

try {
    if (!fs.existsSync(destDir)) {
        console.log(`Creating directory: ${destDir}`);
        fs.mkdirSync(destDir, { recursive: true });
    }

    console.log(`Copying from ${src} to ${dest}`);
    fs.copyFileSync(src, dest);
    console.log('Copy successful!');
} catch (err) {
    console.error('Error during copy:', err);
}
