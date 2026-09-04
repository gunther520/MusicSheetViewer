# SheetTransposer 🎵

An interactive sheet music application that allows musicians to photograph or upload sheet music, automatically detect chords via OCR, and transpose all chords (e.g. 1 key lower, half-step shifts, or custom keys) with instant visual overlay, audio playback preview, and high-resolution export.

---

## 🌟 Key Features

### 1. Photo Capture & Upload
- **Mobile Camera**: Direct back-camera capture with `capture="environment"`.
- **Desktop Webcam**: Built-in camera viewfinder modal with snapshot capture and sheet framing guide.
- **File Upload**: Drag-and-drop or browse for PNG, JPG, JPEG, and WEBP sheet images.
- **Clipboard Paste**: Paste screenshots directly using <kbd>Ctrl</kbd>+<kbd>V</kbd> / <kbd>Cmd</kbd>+<kbd>V</kbd>.
- **Ready-to-Use Sample Sheets**: 3 pre-annotated sheets (Pop Ballad, Jazz Standard ii-V-I with extensions, Acoustic Rock with slash chords) to test transposition immediately.

### 2. Smart Chord Transposition Engine
- **Accurate Pitch Calculations**: Full chromatic transposition supporting all keys (-12 to +12 semitones).
- **One Key Lower Shortcut**: Quick 1-click button for 1 full key lower (-2 semitones, e.g. C → B♭, G → F, D → C).
- **Semitone Stepper & Quick Actions**: -1 st (half step lower), +1 st (half step higher), +2 st (1 key higher), and reset.
- **Key-to-Key Converter**: Directly select original key and target key (e.g. C Major to B♭ Major).
- **Spelling Preferences**: Auto, Prefer Flats (♭), or Prefer Sharps (♯).
- **Rich Chord Support**: Standard major/minor, 7ths, maj7, m7b5, diminished, augmented, sus2/4, add9, alterations, and slash chords (e.g. G/B, D/F#).

### 3. Interactive Sheet Overlay & Editor
- **Native Badge Overlay**: Clean badges placed at exact coordinates on the sheet music, cleanly covering the original chord with the new transposed chord.
- **Multiple Display Modes**: Transposed badge, Dual mode (e.g. `C → B♭`), or transparent outline.
- **Click-to-Add**: Tap anywhere on the sheet music to place a chord at that exact position.
- **Drag-to-Move**: Freely reposition chord overlays on the sheet.
- **Chord Editor Modal**: Click any chord to edit text, test audio, or delete.
- **Zoom & Pan**: Smooth zoom controls (50% to 250%) and reset view.

### 4. Audio Playback & Verification
- **Web Audio Synthesizer**: Built-in polyphonic acoustic tone generator.
- **Individual Chord Play**: Click the speaker icon on any chord badge or sidebar item to hear its voicing.
- **Full Progression Playback**: "Play All Chords Preview" button plays through the entire piece's chords in sequence.

### 5. Automatic OCR Detection
- **Tesseract.js Integration**: Scans uploaded photos/images directly in the browser.
- **Chord Token Filter**: Cleans noise, filters out lyrics, and extracts chord positions.

### 6. Export & Print
- **High-Resolution Export**: Renders sheet image and crisp transposed chord badges onto an offscreen canvas at full original resolution and downloads as PNG.
- **Print Ready**: 1-click print layout optimized for standard paper sizes.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v22)
- npm 10+

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Run Tests
```bash
npm run test
```

### Production Build
```bash
npm run build
```

---

## ☁️ Deployment on Vercel

### One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgunther520%2FMusicSheetViewer)

### Deploy via Vercel CLI
```bash
# Deploy to preview
npx vercel

# Deploy to production
npx vercel --prod
```

### Deploy via Vercel Dashboard
1. Go to [vercel.com/new](https://vercel.com/new).
2. Select your repository `gunther520/MusicSheetViewer`.
3. Vercel will automatically detect `Vite` preset and `vercel.json`.
4. Click **Deploy**.

---

## 🧪 Testing

The codebase includes comprehensive unit and integration tests:
- `src/utils/chordUtils.test.ts`: Chord parsing, root/quality/bass extraction, transposition calculations (including 1 key lower, wrapping, accidentals).
- `src/data/sampleSheets.test.ts`: Sample sheet coordinate validation and progression transposition verification.
- `src/services/ocrService.test.ts`: OCR token sanitization, symbol filtering, and bounding box normalization.
