import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, Music, Sparkles, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { SAMPLE_SHEETS, SampleSheet } from '../data/sampleSheets';
import { CameraModal } from './CameraModal';

interface PhotoUploadProps {
  onSheetSelected: (imageUrl: string, title: string, initialChords?: SampleSheet['defaultChords']) => void;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ onSheetSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Listen for paste event to allow pasting sheet music screenshots directly!
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          processFile(file, 'Pasted Sheet Music');
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const processFile = (file: File, defaultTitle?: string) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WEBP, etc.).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        const title = defaultTitle || file.name.replace(/\.[^/.]+$/, "");
        onSheetSelected(dataUrl, title);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleOpenDesktopCamera = () => {
    setIsCameraModalOpen(true);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      {/* Hero Header */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4 tracking-wide uppercase">
          <Sparkles className="w-3.5 h-3.5" />
          Music Sheet Chord Transposer
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
          Transpose Sheet Music Chords <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">Instantly</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
          Snap a photo of your music sheet or upload an image. Detect chords automatically, transpose them to any key (e.g. 1 key lower), and view or export your new sheet.
        </p>
      </div>

      {/* Main Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all duration-300 backdrop-blur-sm ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/60'
        }`}
      >
        <div className="flex flex-col items-center justify-center max-w-md mx-auto">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 mb-6">
            <Music className="w-10 h-10" />
          </div>

          <h3 className="text-xl font-bold text-white mb-2">
            Upload or Photograph Music Sheet
          </h3>
          <p className="text-sm text-slate-400 mb-6">
            Drag & drop an image here, paste from clipboard (Ctrl+V), or select an option below:
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 w-full">
            {/* Desktop / Webcam Snap */}
            <button
              onClick={handleOpenDesktopCamera}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Camera className="w-4 h-4" />
              Take Photo
            </button>

            {/* Mobile Native Camera (Hidden fallback for direct phone camera launcher) */}
            <input
              ref={mobileCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Browse File Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-600/50 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Upload className="w-4 h-4" />
              Browse Image
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <p className="text-xs text-slate-500 mt-4">
            Supports JPG, PNG, WEBP, screenshots & scanned sheet photos • Enhanced with Multimodal Vision AI & Local OCR
          </p>
        </div>
      </div>

      {/* Preset Sample Sheets */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-indigo-400" />
              Or Try with Ready-to-Transpose Sample Sheets
            </h2>
            <p className="text-xs text-slate-400">
              Select one of these pre-annotated sheets to test transposing chords immediately
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SAMPLE_SHEETS.map((sample) => (
            <div
              key={sample.id}
              onClick={() => onSheetSelected(sample.imageUrl, sample.title, sample.defaultChords)}
              className="group relative bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-white mb-4 border border-slate-700">
                  <img
                    src={sample.imageUrl}
                    alt={sample.title}
                    className="w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                  />
                  <div className="absolute top-2 right-2 px-2.5 py-1 rounded-md bg-slate-900/85 backdrop-blur-sm text-xs font-bold text-indigo-300 border border-slate-700">
                    Key of {sample.originalKey}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-indigo-400">
                    {sample.genre}
                  </span>
                </div>

                <h3 className="font-bold text-base text-white group-hover:text-indigo-300 transition-colors mb-1">
                  {sample.title}
                </h3>

                <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                  {sample.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-700/60 text-xs font-medium text-slate-300 group-hover:text-white">
                <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                  Load & Transpose <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="text-slate-500">
                  {sample.defaultChords.length} chords
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Camera Modal */}
      <CameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(dataUrl) => onSheetSelected(dataUrl, `Photo-${new Date().toLocaleTimeString()}`)}
      />
    </div>
  );
};
