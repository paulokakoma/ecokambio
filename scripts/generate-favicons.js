// Script para gerar favicons a partir do SVG
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'favicon.svg');

async function generateFavicons() {
    const svgBuffer = fs.readFileSync(svgPath);

    // Gerar apple-touch-icon (180x180)
    await sharp(svgBuffer)
        .resize(180, 180)
        .png()
        .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    console.log('✅ apple-touch-icon.png criado');

    // Gerar favicon 32x32 PNG
    await sharp(svgBuffer)
        .resize(32, 32)
        .png()
        .toFile(path.join(publicDir, 'favicon-32x32.png'));
    console.log('✅ favicon-32x32.png criado');

    // Gerar favicon 16x16 PNG
    await sharp(svgBuffer)
        .resize(16, 16)
        .png()
        .toFile(path.join(publicDir, 'favicon-16x16.png'));
    console.log('✅ favicon-16x16.png criado');

    // Gerar favicon.ico (48x48 PNG como fallback)
    // Nota: Sharp não gera .ico nativamente, mas podemos usar PNG
    // A maioria dos browsers modernos aceita PNG como favicon
    await sharp(svgBuffer)
        .resize(48, 48)
        .png()
        .toFile(path.join(publicDir, 'favicon.png'));
    console.log('✅ favicon.png criado (usar como fallback para .ico)');

    // Também copiar como favicon.ico (browsers modernos aceitam PNG)
    await sharp(svgBuffer)
        .resize(48, 48)
        .png()
        .toFile(path.join(publicDir, 'favicon.ico'));
    console.log('✅ favicon.ico criado');

    console.log('\n🎉 Todos os favicons foram gerados em /public/');
}

generateFavicons().catch(console.error);
