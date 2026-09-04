import { ChordPosition, transposeChord, AccidentalPreference } from './chordUtils';

/**
 * Renders the music sheet with transposed chord overlays directly onto a canvas
 * at the sheet's full original resolution.
 */
export async function renderTransposedCanvas(
  imageUrl: string,
  chords: ChordPosition[],
  semitones: number,
  accidentalPreference: AccidentalPreference
): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = imageUrl;
  });

  const canvas = document.createElement('canvas');
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // 1. Draw base sheet music image
  ctx.drawImage(img, 0, 0, width, height);

  // 2. Draw transposed chords
  const baseFontSize = Math.max(16, Math.round(width * 0.024));
  ctx.font = `bold ${baseFontSize}px 'Plus Jakarta Sans', system-ui, sans-serif`;

  chords.forEach((chord) => {
    const transposed = transposeChord(chord.originalText, semitones, accidentalPreference);
    const pixelX = (chord.x / 100) * width;
    const pixelY = (chord.y / 100) * height;

    const textMetrics = ctx.measureText(transposed);
    const textWidth = textMetrics.width;
    const paddingX = baseFontSize * 0.45;
    const paddingY = baseFontSize * 0.35;
    const badgeWidth = textWidth + paddingX * 2;
    const badgeHeight = baseFontSize + paddingY * 2;

    const badgeX = pixelX;
    const badgeY = pixelY - badgeHeight / 2;

    // Draw opaque background pill badge to cover original chord cleanly
    ctx.save();
    ctx.fillStyle = '#0f172a'; // Deep slate
    ctx.strokeStyle = '#6366f1'; // Indigo border
    ctx.lineWidth = Math.max(2, Math.round(width * 0.002));

    // Rounded rectangle
    const radius = 6;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, radius);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(transposed, badgeX + paddingX, badgeY + badgeHeight / 2 + 1);
    ctx.restore();
  });

  return canvas;
}

/**
 * Downloads the transposed sheet as a PNG image file
 */
export async function downloadTransposedSheet(
  imageUrl: string,
  chords: ChordPosition[],
  semitones: number,
  accidentalPreference: AccidentalPreference,
  title: string
): Promise<void> {
  const canvas = await renderTransposedCanvas(imageUrl, chords, semitones, accidentalPreference);

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const semitoneTag = semitones === 0 ? 'original' : `${semitones > 0 ? '+' : ''}${semitones}st`;
  link.download = `transposed-${safeTitle}-${semitoneTag}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Triggers native print dialog for the transposed sheet music
 */
export async function printTransposedSheet(
  imageUrl: string,
  chords: ChordPosition[],
  semitones: number,
  accidentalPreference: AccidentalPreference
): Promise<void> {
  const canvas = await renderTransposedCanvas(imageUrl, chords, semitones, accidentalPreference);
  const dataUrl = canvas.toDataURL('image/png');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print sheet music.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Transposed Music Sheet</title>
        <style>
          @page {
            size: auto;
            margin: 10mm;
          }
          body {
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #fff;
          }
          img {
            max-width: 100%;
            height: auto;
          }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" onload="window.print();window.close();" />
      </body>
    </html>
  `);
  printWindow.document.close();
}
