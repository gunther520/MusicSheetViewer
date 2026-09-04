import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Download,
  Printer,
  Sliders
} from 'lucide-react';
import { AccidentalPreference, MUSICAL_KEYS, getSemitoneDistance } from '../utils/chordUtils';

interface TransposeToolbarProps {
  semitones: number;
  onSemitonesChange: (val: number) => void;
  accidentalPreference: AccidentalPreference;
  onAccidentalPreferenceChange: (pref: AccidentalPreference) => void;
  displayMode: 'badge' | 'dual' | 'outline';
  onDisplayModeChange: (mode: 'badge' | 'dual' | 'outline') => void;
  fontSize: 'sm' | 'md' | 'lg';
  onFontSizeChange: (size: 'sm' | 'md' | 'lg') => void;
  chordCount: number;
  isScanning: boolean;
  onScanOcr: () => void;
  onExport: () => void;
  onPrint: () => void;
  onResetChords: () => void;
  onChangeSheet: () => void;
  visionApiKey?: string;
  onVisionApiKeyChange?: (key: string) => void;
  visionProvider?: 'openai' | 'gemini';
  onVisionProviderChange?: (provider: 'openai' | 'gemini') => void;
}

export const TransposeToolbar: React.FC<TransposeToolbarProps> = ({
  semitones,
  onSemitonesChange,
  accidentalPreference,
  onAccidentalPreferenceChange,
  displayMode,
  onDisplayModeChange,
  fontSize,
  onFontSizeChange,
  chordCount,
  isScanning,
  onScanOcr,
  onExport,
  onPrint,
  onResetChords,
  onChangeSheet,
  visionApiKey = '',
  onVisionApiKeyChange,
  visionProvider = 'openai',
  onVisionProviderChange,
}) => {
  const [fromKey, setFromKey] = React.useState<string>('C');
  const [toKey, setToKey] = React.useState<string>('Bb');
  const [showAdvanced, setShowAdvanced] = React.useState<boolean>(false);

  // Quick preset handlers
  const handleOneKeyLower = () => {
    // 1 full key lower / whole step = -2 semitones
    onSemitonesChange(-2);
  };

  const handleHalfStepLower = () => {
    onSemitonesChange(semitones - 1);
  };

  const handleHalfStepHigher = () => {
    onSemitonesChange(semitones + 1);
  };

  const handleOneKeyHigher = () => {
    onSemitonesChange(2);
  };

  const handleReset = () => {
    onSemitonesChange(0);
  };

  const handleApplyKeyShift = (from: string, to: string) => {
    setFromKey(from);
    setToKey(to);
    const diff = getSemitoneDistance(from, to);
    onSemitonesChange(diff);
  };

  return (
    <div className="w-full bg-slate-900/95 border-b border-slate-800 shadow-xl backdrop-blur-md sticky top-0 z-30 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col gap-3">
        {/* Top Bar: Key Transpose Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Main Transposition Stepper & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
              Transpose:
            </span>

            {/* Quick Button: ONE KEY LOWER (Highlighted as per user prompt!) */}
            <button
              onClick={handleOneKeyLower}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs border transition-all ${
                semitones === -2
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-indigo-500/30 hover:border-indigo-500/60'
              }`}
              title="Transpose 1 whole key lower (-2 semitones, e.g. C to Bb)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              1 Key Lower (-2)
            </button>

            {/* Decrement Half Step (-1) */}
            <button
              onClick={handleHalfStepLower}
              disabled={semitones <= -12}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Half step lower (-1 semitone)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">-1 st</span>
            </button>

            {/* Current Semitone Indicator */}
            <div className="flex flex-col items-center justify-center px-3 py-1 bg-slate-950/80 rounded-xl border border-slate-800 min-w-[120px]">
              <span className="text-xs font-mono font-extrabold text-indigo-400">
                {semitones > 0 ? `+${semitones}` : semitones} semitones
              </span>
              <span className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                {semitones === 0
                  ? 'Original Pitch'
                  : semitones === -2
                  ? 'One Key Lower'
                  : semitones === 2
                  ? 'One Key Higher'
                  : semitones < 0
                  ? `${Math.abs(semitones)} half-steps down`
                  : `${semitones} half-steps up`}
              </span>
            </div>

            {/* Increment Half Step (+1) */}
            <button
              onClick={handleHalfStepHigher}
              disabled={semitones >= 12}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Half step higher (+1 semitone)"
            >
              <span className="hidden sm:inline">+1 st</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Quick Button: ONE KEY HIGHER (+2) */}
            <button
              onClick={handleOneKeyHigher}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs border transition-all ${
                semitones === 2
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-indigo-500/30 hover:border-indigo-500/60'
              }`}
              title="Transpose 1 whole key higher (+2 semitones, e.g. C to D)"
            >
              1 Key Higher (+2)
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Reset to Original (0) */}
            {semitones !== 0 && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 text-xs font-medium transition-colors"
                title="Reset to original key"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>

          {/* Right Toolbar Actions */}
          <div className="flex items-center gap-2">
            {/* OCR Auto-Detect */}
            <button
              onClick={onScanOcr}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all"
              title="Detect chords automatically on sheet using OCR"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isScanning ? 'Scanning...' : 'Scan Chords'}
            </button>

            {/* Advanced Settings Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                showAdvanced
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title="Display & musical preferences"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Settings</span>
              <span className="text-[10px] text-slate-400 font-mono">({chordCount})</span>
            </button>

            {/* Export Transposed Image */}
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
              title="Download sheet with transposed chords"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Print */}
            <button
              onClick={onPrint}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-colors"
              title="Print sheet music"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>

            {/* Change Sheet */}
            <button
              onClick={onChangeSheet}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-colors ml-1"
            >
              New Sheet
            </button>
          </div>
        </div>

        {/* Advanced Settings Drawer */}
        {showAdvanced && (
          <div className="pt-3 pb-1 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs animate-in fade-in duration-150">
            {/* Key to Key Picker */}
            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-slate-400 font-medium">Key Shift:</span>
              <div className="flex items-center gap-1.5">
                <select
                  value={fromKey}
                  onChange={(e) => handleApplyKeyShift(e.target.value, toKey)}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 font-bold text-xs"
                >
                  {MUSICAL_KEYS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <span className="text-slate-500">→</span>
                <select
                  value={toKey}
                  onChange={(e) => handleApplyKeyShift(fromKey, e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 font-bold text-xs"
                >
                  {MUSICAL_KEYS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Accidental Preference */}
            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-slate-400 font-medium">Spelling:</span>
              <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                <button
                  onClick={() => onAccidentalPreferenceChange('auto')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    accidentalPreference === 'auto' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Auto
                </button>
                <button
                  onClick={() => onAccidentalPreferenceChange('flats')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    accidentalPreference === 'flats' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  ♭ Flats
                </button>
                <button
                  onClick={() => onAccidentalPreferenceChange('sharps')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    accidentalPreference === 'sharps' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  ♯ Sharps
                </button>
              </div>
            </div>

            {/* Overlay Style */}
            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-slate-400 font-medium">Display:</span>
              <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                <button
                  onClick={() => onDisplayModeChange('badge')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    displayMode === 'badge' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                  title="Crisp solid badge covering original chord"
                >
                  Transposed
                </button>
                <button
                  onClick={() => onDisplayModeChange('dual')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    displayMode === 'dual' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                  title="Show both original and transposed (e.g. C → Bb)"
                >
                  Dual (C→B♭)
                </button>
                <button
                  onClick={() => onDisplayModeChange('outline')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    displayMode === 'outline' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                  title="Transparent outline"
                >
                  Outline
                </button>
              </div>
            </div>

            {/* Font Size & Chord Reset */}
            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-slate-400 font-medium">Size:</span>
              <div className="flex items-center gap-1">
                {(['sm', 'md', 'lg'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => onFontSizeChange(s)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                      fontSize === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <button
                onClick={onResetChords}
                className="text-slate-400 hover:text-rose-400 text-[11px] font-medium transition-colors ml-2"
                title="Reset all chords to initial state"
              >
                Clear/Reset
              </button>
            </div>

            {/* Vision AI Configuration */}
            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Multimodal Vision AI Chord Scanner (Optional)
                </span>
                <span className="text-[10px] text-slate-400">
                  {visionApiKey ? 'Vision AI mode active' : 'Uses built-in high-precision OCR when no key is set'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={visionProvider}
                  onChange={(e) => onVisionProviderChange?.(e.target.value as 'openai' | 'gemini')}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs font-medium"
                >
                  <option value="openai">OpenAI (GPT-4o-mini)</option>
                  <option value="gemini">Google (Gemini 1.5 Flash)</option>
                </select>
                <input
                  type="password"
                  placeholder="Enter API key (e.g. sk-...) for Vision AI scan"
                  value={visionApiKey}
                  onChange={(e) => onVisionApiKeyChange?.(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
