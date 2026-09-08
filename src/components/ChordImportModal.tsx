import React, { useState } from 'react';
import { FileText, Sparkles, X, AlertCircle } from 'lucide-react';
import { ChordPosition, isValidChord } from '../utils/chordUtils';

interface ChordImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (chords: ChordPosition[]) => void;
}

export const ChordImportModal: React.FC<ChordImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [inputText, setInputText] = useState('');
  const [previewChords, setPreviewChords] = useState<ChordPosition[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParse = (text: string) => {
    setInputText(text);
    setError(null);

    if (!text.trim()) {
      setPreviewChords([]);
      return;
    }

    // Split into lines
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const generated: ChordPosition[] = [];
    let idCounter = 1;

    // Distribute lines evenly across vertical sheet (e.g. from 18% to 88% down the sheet)
    const totalLines = lines.length;
    const topMargin = 18;
    const bottomMargin = 88;
    const yStep = totalLines > 1 ? (bottomMargin - topMargin) / (totalLines - 1) : 0;

    lines.forEach((line, lineIndex) => {
      // Find all chord-like tokens in line
      const tokens = line.split(/[\s,|/]+/).map((t) => t.trim()).filter(Boolean);
      const lineChords: string[] = [];

      tokens.forEach((tok) => {
        if (isValidChord(tok)) {
          lineChords.push(tok);
        }
      });

      if (lineChords.length === 0) return;

      const yPercent = totalLines === 1 ? 25 : topMargin + lineIndex * yStep;
      const leftMargin = 12;
      const rightMargin = 88;
      const xStep = lineChords.length > 1 ? (rightMargin - leftMargin) / (lineChords.length - 1) : 0;

      lineChords.forEach((chordName, chordIndex) => {
        const xPercent = lineChords.length === 1 ? 50 : leftMargin + chordIndex * xStep;

        generated.push({
          id: `imported-${idCounter++}-${Date.now()}`,
          originalText: chordName,
          currentText: chordName,
          x: Math.round(xPercent * 10) / 10,
          y: Math.round(yPercent * 10) / 10,
          width: 5,
          height: 3,
        });
      });
    });

    setPreviewChords(generated);
  };

  const handleConfirmImport = () => {
    if (previewChords.length === 0) {
      setError('No valid musical chords found in text. Example: "C G Am F" or lines of chords.');
      return;
    }
    onImport(previewChords);
    onClose();
  };

  const handlePastePresetExample = () => {
    const sample = `C  C/E  F  G
Bb  C/Bb  Am  Dm
F  G/F  Em  Am
Dm  F/G  C`;
    handleParse(sample);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Import Chords / Progression</h3>
              <p className="text-xs text-slate-400">Paste chords or chord lines to auto-place them on the sheet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Paste Chord Progression (one line per staff line):
              </label>
              <button
                type="button"
                onClick={handlePastePresetExample}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium underline"
              >
                Insert Example
              </button>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => handleParse(e.target.value)}
              placeholder={`Example:\nC  C/E  F  G\nAm  Em  F  C\nDm  G7  C`}
              rows={6}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {previewChords.length > 0 && (
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Detected {previewChords.length} valid chords
                </span>
                <span className="text-indigo-400 font-mono text-[11px]">Ready to place</span>
              </div>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                {previewChords.map((c, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-indigo-950/60 border border-indigo-700/50 text-indigo-200 text-[11px] font-mono rounded font-semibold"
                  >
                    {c.originalText}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={previewChords.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Place {previewChords.length > 0 ? `${previewChords.length} Chords` : 'Chords'} on Sheet
          </button>
        </div>
      </div>
    </div>
  );
};
