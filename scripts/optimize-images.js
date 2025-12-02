#!/usr/bin/env node
/**
 * Image Optimization Script
 * Optimizes images for web performance by:
 * - Converting PNG/JPG to WebP format
 * - Compressing images with optimal quality settings
 * - Generating responsive image sizes
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../public/assets');
const IMAGES_TO_OPTIMIZE = [
    {
        input: 'visa.png',
        outputs: [
            { format: 'webp', quality: 85, suffix: '' },
            { format: 'png', quality: 80, compressionLevel: 9, suffix: '-compressed' }
        ]
    }
];

async function optimizeImage(config) {
    const inputPath = path.join(ASSETS_DIR, config.input);
    const inputName = path.parse(config.input).name;

    if (!fs.existsSync(inputPath)) {
        console.error(`❌ Image not found: ${inputPath}`);
        return;
    }

    console.log(`\n🖼️  Processing: ${config.input}`);

    const originalStats = fs.statSync(inputPath);
    const originalSizeKB = (originalStats.size / 1024).toFixed(2);
    console.log(`   Original size: ${originalSizeKB} KB`);

    for (const output of config.outputs) {
        const suffix = output.suffix || '';
        const ext = output.format;
        const outputFilename = `${inputName}${suffix}.${ext}`;
        const outputPath = path.join(ASSETS_DIR, outputFilename);

        try {
            let pipeline = sharp(inputPath);

            if (output.format === 'webp') {
                pipeline = pipeline.webp({
                    quality: output.quality,
                    effort: 6 // Max effort for best compression
                });
            } else if (output.format === 'png') {
                pipeline = pipeline.png({
                    quality: output.quality,
                    compressionLevel: output.compressionLevel || 9,
                    effort: 10 // Max effort
                });
            } else if (output.format === 'jpeg' || output.format === 'jpg') {
                pipeline = pipeline.jpeg({
                    quality: output.quality,
                    progressive: true,
                    mozjpeg: true
                });
            }

            await pipeline.toFile(outputPath);

            const newStats = fs.statSync(outputPath);
            const newSizeKB = (newStats.size / 1024).toFixed(2);
            const savings = ((1 - newStats.size / originalStats.size) * 100).toFixed(1);

            console.log(`   ✅ Created ${outputFilename}: ${newSizeKB} KB (${savings}% reduction)`);
        } catch (error) {
            console.error(`   ❌ Failed to create ${outputFilename}:`, error.message);
        }
    }
}

async function optimizeAllImages() {
    console.log('🚀 Starting image optimization...\n');

    for (const imageConfig of IMAGES_TO_OPTIMIZE) {
        await optimizeImage(imageConfig);
    }

    console.log('\n✨ Image optimization complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Update HTML files to use the optimized images');
    console.log('   2. Use <picture> element with WebP and fallback formats');
    console.log('   3. Test in multiple browsers to ensure compatibility\n');
}

// Run optimization
optimizeAllImages().catch(error => {
    console.error('❌ Optimization failed:', error);
    process.exit(1);
});
