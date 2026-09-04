import React, { useState } from 'react';
import { Volume2, Play, Square, ListMusic, Plus, Music2, Eye, EyeOff } from 'lucide-react';
import { ChordPosition, transposeChord, AccidentalPreference } from '../utils/chordUtils';
import { chordPlayer } from '../utils/audioUtils';

interface ChordSidebarProps {
  chords: ChordPosition[];
  semitones: number;
  accidentalPreference: AccidentalPreference;
  activeChordId: string | null;
  onSelectChord: (id: string) => void;
  onAddChordClick: () => void;
  showOverlayChords: boolean;
  onToggleOverlayChords: () => void;
}

export const ChordSidebar: React.FC<ChordSidebarProps> = ({
  chords,
  semitones,
  accidentalPreference,
  activeChordId,
  onSelectChord,
  onAddChordClick,
  showOverlayChords,
  onToggleOverlayChords,
}) => {
  const [isPlayingProgression, setIsPlayingProgression] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  // Get unique chords with count
  const uniqueChordsMap = new Map<string, number>();
  chords.forEach((c) => {
    uniqueChordsMap.set(c.originalText, (uniqueChordsMap.get(c.originalText) || 0) + 1);
  });

  const handlePlayChord = (e: React.MouseEvent, chordText: string) => {
    e.stopPropagation();
    const transposed = transposeChord(chordText, semitones, accidentalPreference);
    chordPlayer.playChord(transposed);
  };

  // Play full chord progression through Web Audio
  const handlePlayProgression = async () => {
    if (isPlayingProgression) {
      chordPlayer.stop();
      setIsPlayingProgression(false);
      setPlayingIndex(null);
      return;
    }

    if (chords.length === 0) return;

    setIsPlayingProgression(true);

    for (let i = 0; i < chords.length; i++) {
      if (!isPlayingProgression && i > 0) break;
      setPlayingIndex(i);
      const chord = chords[i];
      const transposed = transposeChord(chord.originalText, semitones, accidentalPreference);
      chordPlayer.playChord(transposed, 0.9);
      await new Promise((r) => setTimeout(r, 950));
    }

    setIsPlayingProgression(false);
    setPlayingIndex(null);
  };

  return (
    <aside className="w-full lg:w-80 bg-slate-900/90 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col h-full max-h-[85vh] lg:max-h-none overflow-hidden">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListMusic className="w-4 h-4 text-indigo-400" />
          <h3 className="font-bold text-sm text-white">Chords Overview</h3>
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[11px] font-bold">
            {chords.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleOverlayChords}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1"
            title={showOverlayChords ? 'Hide overlay on sheet' : 'Show overlay on sheet'}
          >
            {showOverlayChords ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          <button
            onClick={onAddChordClick}
            className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1 transition-colors"
            title="Add a new chord to the sheet"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>

      {/* Audio Playback Controls */}
      <div className="p-3 bg-slate-950/60 border-b border-slate-800">
        <button
          onClick={handlePlayProgression}
          disabled={chords.length === 0}
          className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-semibold text-xs transition-all shadow-md ${
            isPlayingProgression
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
              : 'bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/30 shadow-indigo-600/10'
          }`}
        >
          {isPlayingProgression ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop Playing
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Play All Chords Preview
            </>
          )}
        </button>
      </div>

      {/* Unique Chords Pill Strip */}
      {uniqueChordsMap.size > 0 && (
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Unique Chords ({uniqueChordsMap.size})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(uniqueChordsMap.entries()).map(([orig, count]) => {
              const trans = transposeChord(orig, semitones, accidentalPreference);
              return (
                <button
                  key={orig}
                  onClick={(e) => handlePlayChord(e, orig)}
                  className="group flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 text-xs transition-all"
                  title={`Original: ${orig} → Transposed: ${trans}. Click to hear audio.`}
                >
                  <span className="font-bold text-white font-mono group-hover:text-indigo-300">
                    {trans}
                  </span>
                  {semitones !== 0 && (
                    <span className="text-[10px] text-slate-500 line-through">
                      {orig}
                    </span>
                  )}
                  {count > 1 && (
                    <span className="text-[9px] px-1 rounded bg-slate-700 text-slate-400">
                      x{count}
                    </span>
                  )}
                  <Volume2 className="w-2.5 h-2.5 text-slate-500 group-hover:text-indigo-400 ml-0.5" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sequential Chords List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1 mb-1">
          Sequential Order in Sheet
        </span>

        {chords.length === 0 ? (
          <div className="text-center py-8 px-4 text-slate-500">
            <Music2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No chords detected yet.</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Click &quot;Scan Chords&quot; or tap anywhere on the sheet to place chords.
            </p>
          </div>
        ) : (
          chords.map((chord, idx) => {
            const transposed = transposeChord(chord.originalText, semitones, accidentalPreference);
            const isPlayingThis = playingIndex === idx;
            const isSelected = activeChordId === chord.id;

            return (
              <div
                key={chord.id}
                onClick={() => onSelectChord(chord.id)}
                className={`group flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer border transition-all ${
                  isPlayingThis
                    ? 'bg-indigo-600/30 border-indigo-500 text-white ring-1 ring-indigo-500'
                    : isSelected
                    ? 'bg-slate-800 border-indigo-500/80 text-white'
                    : 'bg-slate-800/50 hover:bg-slate-800 border-slate-800/80 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 text-[10px] font-mono text-slate-500">
                    {idx + 1}.
                  </span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="font-bold text-sm text-indigo-400">
                      {transposed}
                    </span>
                    {semitones !== 0 && (
                      <span className="text-[11px] text-slate-500">
                        (orig: {chord.originalText})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handlePlayChord(e, chord.originalText)}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-indigo-300 transition-colors"
                    title="Play chord audio"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
