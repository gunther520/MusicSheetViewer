import React, { useState } from 'react';
import { Music, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { PhotoUpload } from './components/PhotoUpload';
import { SheetViewer } from './components/SheetViewer';
import { TransposeToolbar } from './components/TransposeToolbar';
import { ChordSidebar } from './components/ChordSidebar';
import { ChordEditorModal } from './components/ChordEditorModal';
import { ChordImportModal } from './components/ChordImportModal';
import { ChordPosition, AccidentalPreference } from './utils/chordUtils';
import { scanSheetWithFallback } from './services/ocrService';
import { downloadTransposedSheet, printTransposedSheet } from './utils/exportUtils';
import { SAMPLE_SHEETS } from './data/sampleSheets';

export const App: React.FC = () => {
  // Main sheet state
  const [sheetImage, setSheetImage] = useState<string | null>(null);
  const [sheetTitle, setSheetTitle] = useState<string>('');
  const [initialPresetChords, setInitialPresetChords] = useState<ChordPosition[]>([]);
  const [chords, setChords] = useState<ChordPosition[]>([]);

  // Transposition state
  const [semitones, setSemitones] = useState<number>(0);
  const [accidentalPreference, setAccidentalPreference] = useState<AccidentalPreference>('auto');

  // Display preferences
  const [displayMode, setDisplayMode] = useState<'badge' | 'dual' | 'outline'>('badge');
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [showOverlayChords, setShowOverlayChords] = useState<boolean>(true);

  // Active chord selection & modal editor
  const [activeChordId, setActiveChordId] = useState<string | null>(null);
  const [editingChord, setEditingChord] = useState<ChordPosition | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);

  // OCR scanning state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [notification, setNotification] = useState<string | null>(null);

  // Vision AI Settings state (stored in localStorage)
  const [visionApiKey, setVisionApiKey] = useState<string>(() => localStorage.getItem('vision_api_key') || '');
  const [visionProvider, setVisionProvider] = useState<'openai' | 'gemini'>('openai');

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Handle sheet loaded
  const handleSheetSelected = (
    imageUrl: string,
    title: string,
    defaultChords?: ChordPosition[]
  ) => {
    setSheetImage(imageUrl);
    setSheetTitle(title);
    setSemitones(0);
    const chordsToSet = defaultChords ? [...defaultChords] : [];
    setInitialPresetChords(chordsToSet);
    setChords(chordsToSet);

    if (chordsToSet.length > 0) {
      showNotification(`Loaded "${title}" with ${chordsToSet.length} chords ready to transpose!`);
    } else {
      showNotification('Sheet loaded! Click "Scan Chords" to run OCR or click sheet to add chords.');
    }
  };

  // OCR / Vision Scanner
  const handleScanOcr = async () => {
    if (!sheetImage || isScanning) return;
    setIsScanning(true);
    setScanProgress(0);
    setScanStatus(visionApiKey ? 'Starting Vision AI chord scan...' : 'Initializing OCR engine...');

    try {
      const detected = await scanSheetWithFallback(
        sheetImage,
        {
          apiKey: visionApiKey || undefined,
          provider: visionProvider,
          apiEndpoint: '/api/detect-chords',
        },
        (p) => {
          setScanStatus(p.status);
          setScanProgress(p.progress);
        }
      );

      if (detected.length > 0) {
        setChords(detected);
        showNotification(`Success! Found ${detected.length} chords on your music sheet.`);
      } else {
        showNotification('No chords automatically detected. You can click anywhere on the sheet to place chords!');
      }
    } catch (err) {
      console.error('Scan error:', err);
      showNotification('Scan encountered an issue. You can click on the sheet to manually add chords.');
    } finally {
      setIsScanning(false);
    }
  };

  // Add chord at click location
  const handleAddChordAtPosition = (xPercent: number, yPercent: number) => {
    const newChord: ChordPosition = {
      id: `manual-${Date.now()}`,
      originalText: 'C',
      currentText: 'C',
      x: xPercent,
      y: yPercent,
      width: 5,
      height: 3,
    };

    setChords((prev) => [...prev, newChord]);
    setEditingChord(newChord);
    setIsEditorOpen(true);
    setActiveChordId(newChord.id);
  };

  const handleUpdateChordPosition = (id: string, x: number, y: number) => {
    setChords((prev) =>
      prev.map((c) => (c.id === id ? { ...c, x, y } : c))
    );
  };

  const handleEditChord = (chord: ChordPosition) => {
    setEditingChord(chord);
    setIsEditorOpen(true);
    setActiveChordId(chord.id);
  };

  const handleSaveChord = (updated: ChordPosition) => {
    setChords((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    setEditingChord(null);
  };

  const handleDeleteChord = (id: string) => {
    setChords((prev) => prev.filter((c) => c.id !== id));
    if (activeChordId === id) setActiveChordId(null);
    if (editingChord?.id === id) {
      setEditingChord(null);
      setIsEditorOpen(false);
    }
    showNotification('Chord deleted successfully');
  };

  const handleResetChords = () => {
    if (confirm('Reset chords to original state?')) {
      setChords([...initialPresetChords]);
      setSemitones(0);
      showNotification('Chords reset to original state.');
    }
  };

  const handleExport = async () => {
    if (!sheetImage) return;
    try {
      showNotification('Generating high-res transposed music sheet...');
      await downloadTransposedSheet(sheetImage, chords, semitones, accidentalPreference, sheetTitle);
      showNotification('Transposed sheet music downloaded successfully!');
    } catch (err) {
      console.error('Export error:', err);
      alert('Could not generate export. Please try again.');
    }
  };

  const handlePrint = async () => {
    if (!sheetImage) return;
    try {
      await printTransposedSheet(sheetImage, chords, semitones, accidentalPreference);
    } catch (err) {
      console.error('Print error:', err);
      alert('Could not open print window.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Global Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 flex items-center justify-between z-40 shrink-0">
        <div className="flex items-center gap-3">
          {sheetImage && (
            <button
              onClick={() => setSheetImage(null)}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Return to sheet upload"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                SheetTransposer
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  PRO
                </span>
              </span>
            </div>
          </div>
        </div>

        {sheetImage && (
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-400">
            <span className="text-slate-300 font-semibold truncate max-w-xs">{sheetTitle}</span>
            <span>•</span>
            <span className="text-indigo-400 font-mono font-bold">
              {semitones === 0
                ? 'Original Key'
                : `${semitones > 0 ? `+${semitones}` : semitones} st (${semitones === -2 ? '1 Key Lower' : semitones < 0 ? 'Lower' : 'Higher'})`}
            </span>
          </div>
        )}

        {/* Demo Quick Switcher in header */}
        <div className="flex items-center gap-2">
          {!sheetImage ? (
            <button
              onClick={() => {
                const sample = SAMPLE_SHEETS[0];
                handleSheetSelected(sample.imageUrl, sample.title, sample.defaultChords);
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
            >
              Quick Demo
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 hidden lg:inline">Quick Samples:</span>
              <div className="flex items-center gap-1">
                {SAMPLE_SHEETS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSheetSelected(s.imageUrl, s.title, s.defaultChords)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 hover:text-white transition-colors"
                  >
                    {s.title.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-indigo-950/90 border border-indigo-500/50 text-indigo-200 rounded-2xl shadow-2xl backdrop-blur-md text-xs font-medium animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Workspace Body */}
      {!sheetImage ? (
        <main className="flex-1 overflow-y-auto">
          <PhotoUpload onSheetSelected={handleSheetSelected} />
        </main>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Transpose & Control Toolbar */}
          <TransposeToolbar
            semitones={semitones}
            onSemitonesChange={setSemitones}
            accidentalPreference={accidentalPreference}
            onAccidentalPreferenceChange={setAccidentalPreference}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            chordCount={chords.length}
            isScanning={isScanning}
            onScanOcr={handleScanOcr}
            onExport={handleExport}
            onPrint={handlePrint}
            onResetChords={handleResetChords}
            onChangeSheet={() => setSheetImage(null)}
            visionApiKey={visionApiKey}
            onVisionApiKeyChange={(key) => {
              setVisionApiKey(key);
              localStorage.setItem('vision_api_key', key);
            }}
            visionProvider={visionProvider}
            onVisionProviderChange={setVisionProvider}
            onImportChordsClick={() => setIsImportOpen(true)}
          />

          {/* Viewer & Sidebar Workspace */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            {/* Sheet Canvas Viewer */}
            <SheetViewer
              imageUrl={sheetImage}
              sheetTitle={sheetTitle}
              chords={chords}
              semitones={semitones}
              accidentalPreference={accidentalPreference}
              displayMode={displayMode}
              fontSize={fontSize}
              showOverlayChords={showOverlayChords}
              activeChordId={activeChordId}
              onSelectChord={setActiveChordId}
              onUpdateChordPosition={handleUpdateChordPosition}
              onEditChord={handleEditChord}
              onDeleteChord={handleDeleteChord}
              onAddChordAtPosition={handleAddChordAtPosition}
              isScanning={isScanning}
              scanStatus={scanStatus}
              scanProgress={scanProgress}
            />

            {/* Chords Overview Sidebar */}
            <ChordSidebar
              chords={chords}
              semitones={semitones}
              accidentalPreference={accidentalPreference}
              activeChordId={activeChordId}
              onSelectChord={(id) => {
                setActiveChordId(id);
                const found = chords.find((c) => c.id === id);
                if (found) setEditingChord(found);
              }}
              onEditChord={handleEditChord}
              onAddChordClick={() => handleAddChordAtPosition(50, 20)}
              onDeleteChord={handleDeleteChord}
              showOverlayChords={showOverlayChords}
              onToggleOverlayChords={() => setShowOverlayChords(!showOverlayChords)}
              onImportChordsClick={() => setIsImportOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Modal for Editing / Adding Chord */}
      <ChordEditorModal
        chord={editingChord}
        isOpen={isEditorOpen}
        semitones={semitones}
        accidentalPreference={accidentalPreference}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingChord(null);
        }}
        onSave={handleSaveChord}
        onDelete={handleDeleteChord}
      />

      {/* Quick Chord Progression Import Modal */}
      <ChordImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={(importedChords) => {
          setChords((prev) => [...prev, ...importedChords]);
          showNotification(`Added ${importedChords.length} chords across your sheet! Drag or click to adjust.`);
        }}
      />
    </div>
  );
};
