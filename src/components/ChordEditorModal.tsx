import React, { useState } from 'react';
import { Volume2, Trash2, Check, X, Sparkles } from 'lucide-react';
import { ChordPosition, isValidChord, transposeChord, AccidentalPreference } from '../utils/chordUtils';
import { chordPlayer } from '../utils/audioUtils';

interface ChordEditorModalProps {
  chord: ChordPosition | null;
  isOpen: boolean;
  semitones: number;
  accidentalPreference: AccidentalPreference;
  onClose: () => void;
  onSave: (updatedChord: ChordPosition) => void;
  onDelete: (id: string) => void;
}

export const ChordEditorModal: React.FC<ChordEditorModalProps> = ({
  chord,
  isOpen,
  semitones,
  accidentalPreference,
  onClose,
  onSave,
  onDelete,
}) => {
  if (!isOpen || !chord) return null;

  const [text, setText] = useState(chord.originalText);
  const isValid = isValidChord(text);
  const transposed = isValid ? transposeChord(text, semitones, accidentalPreference) : text;

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({
      ...chord,
      originalText: text.trim(),
      currentText: text.trim(),
    });
    onClose();
  };

  const handlePlay = () => {
    if (isValid) {
      chordPlayer.playChord(transposed);
    }
  };

  const commonChords = ['C', 'C/E', 'G', 'G/F', 'Am', 'F', 'D', 'Em', 'Dm', 'C7', 'Bb', 'Bb/C', 'Gsus4', 'F/G'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Edit Chord
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Original Chord Symbol
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. C, F#m7, G/B"
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-lg font-bold focus:outline-none focus:border-indigo-500 transition-colors"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
            {!isValid && text.trim().length > 0 && (
              <p className="text-xs text-amber-400 mt-1">
                Tip: Standard format like C, Am, G7, Bb/D
              </p>
            )}
          </div>

          {/* Quick chord suggestion pills */}
          <div>
            <span className="text-[11px] font-medium text-slate-400 mb-1.5 block">Quick select:</span>
            <div className="flex flex-wrap gap-1.5">
              {commonChords.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setText(c)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-md text-xs font-mono font-medium text-slate-300 hover:text-white transition-colors"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Transposed Preview */}
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                Transposed Result ({semitones >= 0 ? `+${semitones}` : semitones} st)
              </span>
              <span className="text-xl font-bold font-mono text-indigo-400">
                {transposed}
              </span>
            </div>

            <button
              onClick={handlePlay}
              title="Hear transposed chord audio"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Play
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={() => {
              onDelete(chord.id);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs font-semibold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
