// Compress a data-URL image down to a JPEG that fits comfortably inside a Firestore document
// (Firestore caps documents at 1 MiB). Resizes to max 800 px on the long edge, then re-encodes
// at quality 0.6. A 4 MB phone photo typically lands ~150–400 KB after this.

export async function compressDataUrl(
  dataUrl: string,
  maxDim = 800,
  quality = 0.6
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * ratio);
      const h = Math.round(img.naturalHeight * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      // White background — keeps PDFs / transparent PNGs from going dark when re-encoded.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
}
