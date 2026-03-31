/**
 * textOverlay.ts
 *
 * Browser-side canvas text overlay utility.
 * Supports top, middle, and bottom positioning.
 *
 * Exported functions:
 *   burnTextOverlay(imageUrl, text, position)       → Promise<Blob>
 *   burnTextOverlayBase64(imageUrl, text, position) → Promise<string>
 */

export type TextPosition = 'top' | 'middle' | 'bottom';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (_event, _source, _line, _col, err) =>
      reject(err ?? new Error(`textOverlay: failed to load image from "${url}".`));
    img.src = url;
  });
}

function compositeTextOnCanvas(
  img: HTMLImageElement,
  text: string,
  position: TextPosition = 'bottom'
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('textOverlay: could not obtain 2D canvas context');

  // 1. Draw base image
  ctx.drawImage(img, 0, 0, img.width, img.height);

  // 2. Geometry
  const boxWidth = img.width * 0.75;
  const fontSize = Math.floor(img.width * 0.038);
  const padding = fontSize * 1.5;
  const lineHeight = fontSize * 1.35;

  // 3. Font
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 4. Flatten newlines
  const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleanText.split(' ');

  // 5. Word-wrap — max 3 lines
  let line = '';
  const lines: string[] = [];

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);

    if (metrics.width > boxWidth - padding * 2 && n > 0) {
      if (lines.length >= 2) {
        line = line.trim() + '...';
        break;
      }
      lines.push(line);
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }

  if (lines.length < 3 && line) {
    lines.push(line);
  }

  // 6. Box dimensions
  const boxHeight = lines.length * lineHeight + padding * 1.5;
  const boxX = (img.width - boxWidth) / 2;

  // 7. Position-dependent Y coordinate
  let boxY: number;
  switch (position) {
    case 'top':
      boxY = img.height * 0.06; // 6% from top
      break;
    case 'middle':
      boxY = (img.height - boxHeight) / 2; // centered
      break;
    case 'bottom':
    default:
      boxY = img.height - boxHeight - img.height * 0.12; // 12% above bottom
      break;
  }

  const r = Math.min(24, boxHeight / 2);

  // 8. Rounded-rectangle background
  ctx.fillStyle = 'rgba(70, 60, 50, 0.85)';
  ctx.beginPath();
  ctx.moveTo(boxX + r, boxY);
  ctx.lineTo(boxX + boxWidth - r, boxY);
  ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + r);
  ctx.lineTo(boxX + boxWidth, boxY + boxHeight - r);
  ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - r, boxY + boxHeight);
  ctx.lineTo(boxX + r, boxY + boxHeight);
  ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - r);
  ctx.lineTo(boxX, boxY + r);
  ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
  ctx.closePath();
  ctx.fill();

  // 9. White centered text
  ctx.fillStyle = '#ffffff';
  let textY = boxY + padding + fontSize / 2;
  for (const l of lines) {
    ctx.fillText(l.trim(), img.width / 2, textY);
    textY += lineHeight;
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function burnTextOverlay(
  imageUrl: string,
  text: string,
  position: TextPosition = 'bottom'
): Promise<Blob> {
  const img = await loadImage(imageUrl);
  const canvas = compositeTextOnCanvas(img, text, position);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('textOverlay: canvas.toBlob returned null'));
      },
      'image/jpeg',
      0.95
    );
  });
}

export async function burnTextOverlayBase64(
  imageUrl: string,
  text: string,
  position: TextPosition = 'bottom'
): Promise<string> {
  const img = await loadImage(imageUrl);
  const canvas = compositeTextOnCanvas(img, text, position);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  if (dataUrl === 'data:,') {
    throw new Error('textOverlay: canvas.toDataURL returned empty');
  }
  return dataUrl;
}
