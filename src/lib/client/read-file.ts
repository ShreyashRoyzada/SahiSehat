"use client";
// Reads a report or cart screenshot on the person's device. The file itself
// never leaves the browser; only the extracted text is sent to the server.

export async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Group text items into lines by their y position.
    const lines = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      lines.set(y, [...(lines.get(y) ?? []), { x: item.transform[4], s: item.str }]);
    }
    const text = [...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((p) => p.s).join("  "))
      .join("\n");
    pages.push(text);
  }
  return pages.join("\n");
}

export async function imageToText(file: File, onProgress?: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export async function fileToText(file: File, onProgress?: (p: number) => void): Promise<string> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return pdfToText(file);
  if (file.type.startsWith("image/")) return imageToText(file, onProgress);
  if (file.type.startsWith("text/")) return file.text();
  throw new Error("Use a PDF, a photo or a screenshot.");
}
