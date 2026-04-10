const Tesseract = require('tesseract.js');
const imgPath = '/Users/av/.gemini/antigravity/brain/6a3073d5-bff7-448d-9a80-db694e7d6b3c/bai_cambios_page_1775462991226.png';
Tesseract.recognize(
  imgPath,
  'por',
  { logger: m => console.log(m) }
).then(({ data: { text } }) => {
  console.log("OCR Extracted Text:");
  console.log(text);
}).catch(e => console.log("OCR Error:", e));
