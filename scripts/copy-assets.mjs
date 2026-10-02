// Copies the PDF.js worker into public/ so reports are read on the device.
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/vendor/pdf.worker.min.mjs");
console.log("copied pdf.worker.min.mjs to public/vendor");
