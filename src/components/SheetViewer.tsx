import React, { useRef, useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Volume2, Edit3, Trash2 } from 'lucide-react';
import { ChordPosition, transposeChord, AccidentalPreference } from '../utils/chordUtils';
import { chordPlayer } from '../utils/audioUtils';

interface SheetViewerProps {
  imageUrl: string;
  sheetTitle: string;
  chords: ChordPosition[];
  semitones: number;
  accidentalPreference: AccidentalPreference;
  displayMode: 'badge' | 'dual' | 'outline';
  fontSize: 'sm' | 'md' | 'lg';
  showOverlayChords: boolean;
  activeChordId: string | null;
  onSelectChord: (id: string | null) => void;
  onUpdateChordPosition: (id: string, x: number, y: number) => void;
  onEditChord: (chord: ChordPosition) => void;
  onDeleteChord: (id: string) => void;
  onAddChordAtPosition: (x: number, y: number) => void;
  isScanning: boolean;
  scanStatus: string;
  scanProgress: number;
}

export const SheetViewer: React.FC<SheetViewerProps> = ({
  imageUrl,
  sheetTitle,
  chords,
  semitones,
  accidentalPreference,
  displayMode,
  fontSize,
  showOverlayChords,
  activeChordId,
  onSelectChord,
  onUpdateChordPosition,
  onEditChord,
  onDeleteChord,
  onAddChordAtPosition,
  isScanning,
  scanStatus,
  scanProgress,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [draggingChordId, setDraggingChordId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredChordId, setHoveredChordId] = useState<string | null>(null);

  // Reset zoom when image changes
  useEffect(() => {
    setZoom(1);
  }, [imageUrl]);

  const handleZoomIn = () => setZoom((prev) => Math.min(2.5, prev + 0.2));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.5, prev - 0.2));
  const handleZoomReset = () => setZoom(1);

  // Handle clicking on the sheet to place a new chord
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If we just finished dragging, ignore
    if (draggingChordId) return;

    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();

    const clientX = e.clientX;
    const clientY = e.clientY;

    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      const xPercent = ((clientX - rect.left) / rect.width) * 100;
      const yPercent = ((clientY - rect.top) / rect.height) * 100;

      onAddChordAtPosition(xPercent, yPercent);
    }
  };

  // Drag & drop logic for moving chords
  const handleChordMouseDown = (e: React.MouseEvent, chord: ChordPosition) => {
    e.stopPropagation();
    setDraggingChordId(chord.id);
    onSelectChord(chord.id);

    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const chordPixelX = (chord.x / 100) * rect.width;
      const chordPixelY = (chord.y / 100) * rect.height;
      setDragOffset({
        x: e.clientX - rect.left - chordPixelX,
        y: e.clientY - rect.top - chordPixelY,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingChordId || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - dragOffset.x;
    const mouseY = e.clientY - rect.top - dragOffset.y;

    const newX = Math.max(0, Math.min(96, (mouseX / rect.width) * 100));
    const newY = Math.max(0, Math.min(96, (mouseY / rect.height) * 100));

    onUpdateChordPosition(draggingChordId, newX, newY);
  };

  const handleMouseUp = () => {
    if (draggingChordId) {
      setDraggingChordId(null);
    }
  };

  const fontSizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-2.5 py-1',
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="relative flex-1 bg-slate-950 flex flex-col overflow-hidden select-none min-h-[500px]"
    >
      {/* Floating Toolbar: Zoom & View Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700/80 shadow-xl">
        <button
          onClick={handleZoomOut}
          className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono font-bold text-slate-300 px-1 min-w-[45px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />
        <button
          onClick={handleZoomReset}
          className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          title="Reset Zoom"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Sheet Instruction Pill */}
      <div className="absolute top-4 left-4 z-20 hidden md:flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-slate-700/80 text-xs text-slate-300 shadow-xl">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Click anywhere on sheet to add/edit • Drag to reposition • Hover chord for quick actions</span>
      </div>

      {/* Main Sheet Music Canvas Container */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4 sm:p-8">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          className="relative transition-transform duration-100 ease-out shadow-2xl rounded-xl overflow-hidden bg-white max-w-full"
        >
          {/* Base Sheet Music Image */}
          <img
            ref={imageRef}
            src={imageUrl}
            alt={sheetTitle}
            onClick={handleImageClick}
            className="block max-w-full h-auto cursor-crosshair select-none"
            draggable={false}
          />

          {/* OCR Scanning Overlay */}
          {isScanning && (
            <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center p-6 text-center text-white">
              {/* Animated scanline */}
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_15px_#6366f1] animate-[scan_2s_ease-in-out_infinite]" />

              <div className="bg-slate-900/90 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full">
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-indigo-500 border-t-transparent mx-auto mb-4" />
                <h4 className="font-bold text-base text-white mb-1">
                  Scanning Sheet for Chords
                </h4>
                <p className="text-xs text-slate-400 mb-4">{scanStatus}</p>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                    style={{ width: `${Math.round(scanProgress * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-indigo-400 mt-2 block">
                  {Math.round(scanProgress * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Render Chords Overlay */}
          {showOverlayChords &&
            chords.map((chord) => {
              const transposed = transposeChord(
                chord.originalText,
                semitones,
                accidentalPreference
              );
              const isSelected = activeChordId === chord.id;
              const isHovered = hoveredChordId === chord.id;
              const isDragging = draggingChordId === chord.id;

              return (
                <div
                  key={chord.id}
                  style={{
                    left: `${chord.x}%`,
                    top: `${chord.y}%`,
                  }}
                  onMouseDown={(e) => handleChordMouseDown(e, chord)}
                  onMouseEnter={() => setHoveredChordId(chord.id)}
                  onMouseLeave={() => setHoveredChordId(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditChord(chord);
                  }}
                  className={`absolute transform -translate-y-1/2 cursor-grab active:cursor-grabbing font-bold font-mono transition-shadow ${
                    fontSizeClasses[fontSize]
                  } ${
                    isDragging ? 'z-40 scale-110 shadow-2xl' : isSelected ? 'z-30' : 'z-10'
                  } ${
                    displayMode === 'badge'
                      ? 'bg-slate-900 text-white rounded-md shadow-md border border-indigo-400/80 hover:bg-slate-800 hover:border-indigo-400'
                      : displayMode === 'dual'
                      ? 'bg-slate-900/95 text-white rounded-md shadow border border-indigo-500/80 px-2'
                      : 'bg-indigo-900/70 text-indigo-100 rounded border border-indigo-400'
                  }`}
                >
                  <div className="flex items-center gap-1 leading-none">
                    {displayMode === 'dual' && semitones !== 0 ? (
                      <span className="flex items-center gap-1">
                        <span className="text-slate-400 text-[10px] line-through">
                          {chord.originalText}
                        </span>
                        <span className="text-indigo-400">→</span>
                        <span className="text-white font-extrabold">{transposed}</span>
                      </span>
                    ) : (
                      <span className={semitones !== 0 ? 'text-indigo-300 font-extrabold' : 'text-white'}>
                        {transposed}
                      </span>
                    )}

                    {/* Quick action buttons on hover */}
                    {(isHovered || isSelected) && !isDragging && (
                      <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-slate-700">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            chordPlayer.playChord(transposed);
                          }}
                          className="p-0.5 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-800"
                          title="Play Audio"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditChord(chord);
                          }}
                          className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                          title="Edit"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteChord(chord.id);
                          }}
                          className="p-0.5 text-rose-400 hover:text-white hover:bg-rose-600 rounded transition-colors"
                          title="Quick Remove"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
