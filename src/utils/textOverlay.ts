/**
 * textOverlay.ts
 *
 * Browser-side canvas text overlay utility.
 *
 * Direct port of the server-side node-canvas implementation in server.ts (lines 436-509).
 * Rendering parameters are intentionally identical so client-side previews match
 * server-produced media pixel-for-pixel.
 *
 * Exported functions:
 *   burnTextOverlay(imageUrl, text)       → Promise<Blob>   (JPEG, quality 0.95)
 *   burnTextOverlayBase64(imageUrl, text) → Promise<string> (data URL, JPEG, quality 0.95)
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Load an image from a URL into an HTMLImageElement.
 *
 * Cross-origin note: the `crossOrigin = 'anonymous'` attribute instructs the
 * browser to send a CORS request.  If the origin server does not return the
 * appropriate `Access-Control-Allow-Origin` header the load will fail — the
 * same constraint that applies to any canvas `drawImage` call that must later
 * be read back via `toBlob` / `toDataURL`.
 *
 * For Supabase Storage URLs (and most CDN-served assets) CORS is open by
 * default.  For truly opaque third-party URLs the caller should proxy the
 * image through a CORS-friendly endpoint or convert it to base64 server-side
 * before passing it here.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    // Must be set BEFORE src so the CORS handshake covers the initial fetch.
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = (_event, _source, _line, _col, err) =>
      reject(
        err ??
          new Error(
            `textOverlay: failed to load image from "${url}". ` +
              'If the image is cross-origin, ensure the server returns ' +
              'Access-Control-Allow-Origin headers.'
          )
      );

    img.src = url;
  });
}

/**
 * Core compositing logic — mirrors server.ts lines 440-508 exactly.
 *
 * Returns the raw canvas so callers can export in whichever format they need.
 */
function compositeTextOnCanvas(
  img: HTMLImageElement,
  text: string
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('textOverlay: could not obtain 2D canvas context');

  // 1. Draw base image
  ctx.drawImage(img, 0, 0, img.width, img.height);

  // 2. Geometry — identical constants to server
  const boxWidth = img.width * 0.75;
  const fontSize = Math.floor(img.width * 0.038); // tighter, elegantly smaller scaling
  const padding = fontSize * 1.5;
  const lineHeight = fontSize * 1.35;

  // 3. Font — must be set before measureText calls
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 4. Flatten AI-generated newlines into a continuous string
  const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleanText.split(' ');

  // 5. Word-wrap — max 3 lines with hard ellipsis cap (mirrors server logic)
  let line = '';
  const lines: string[] = [];

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);

    if (metrics.width > boxWidth - padding * 2 && n > 0) {
      if (lines.length >= 2) {
        // Hard cap: truncate current line with ellipsis and stop
        line = line.trim() + '...';
        break;
      }
      lines.push(line);
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }

  // Push any remaining text as the final line (mirrors `if (lines.length < 3 && line)`)
  if (lines.length < 3 && line) {
    lines.push(line);
  }

  // 6. Box dimensions and position
  const boxHeight = lines.length * lineHeight + padding * 1.5;
  const boxX = (img.width - boxWidth) / 2;
  const boxY = img.height - boxHeight - img.height * 0.12; // 12% above bottom frame
  const r = Math.min(24, boxHeight / 2); // rounded corner radius

  // 7. Rounded-rectangle background: rgba(70, 60, 50, 0.85)
  ctx.fillStyle = 'rgba(70, 60, 50, 0.85)';
  ctx.beginPath();
  ctx.moveTo(boxX + r, boxY);
  ctx.lineTo(boxX + boxWidth - r, boxY);
  ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + r);
  ctx.lineTo(boxX + boxWidth, boxY + boxHeight - r);
  ctx.quadraticCurveTo(
    boxX + boxWidth,
    boxY + boxHeight,
    boxX + boxWidth - r,
    boxY + boxHeight
  );
  ctx.lineTo(boxX + r, boxY + boxHeight);
  ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - r);
  ctx.lineTo(boxX, boxY + r);
  ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
  ctx.closePath();
  ctx.fill();

  // 8. White centered text
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

/**
 * Composite a text overlay onto an image and return the result as a Blob.
 *
 * @param imageUrl - Absolute URL or base64 data URL of the source image.
 * @param text     - The text string to burn in.  Newlines are collapsed to spaces.
 * @returns        - Promise resolving to a JPEG Blob at quality 0.95.
 */
export async function burnTextOverlay(
  imageUrl: string,
  text: string
): Promise<Blob> {
  const img = await loadImage(imageUrl);
  const canvas = compositeTextOnCanvas(img, text);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(
            new Error(
              'textOverlay: canvas.toBlob returned null — ' +
                'the canvas may be tainted by a cross-origin image.'
            )
          );
        }
      },
      'image/jpeg',
      0.95 // matches server: { quality: 0.95 }
    );
  });
}

/**
 * Composite a text overlay onto an image and return the result as a data URL.
 *
 * @param imageUrl - Absolute URL or base64 data URL of the source image.
 * @param text     - The text string to burn in.  Newlines are collapsed to spaces.
 * @returns        - Promise resolving to a JPEG data URL at quality 0.95.
 */
export async function burnTextOverlayBase64(
  imageUrl: string,
  text: string
): Promise<string> {
  const img = await loadImage(imageUrl);
  const canvas = compositeTextOnCanvas(img, text);

  // toDataURL is synchronous — wrap in Promise for a consistent async API
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

  if (dataUrl === 'data:,') {
    throw new Error(
      'textOverlay: canvas.toDataURL returned empty — ' +
        'the canvas may be tainted by a cross-origin image.'
    );
  }

  return dataUrl;
}
