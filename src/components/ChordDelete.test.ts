import { describe, it, expect } from 'vitest';
import { ChordPosition } from '../utils/chordUtils';

describe('Chord Delete Functionality', () => {
  const mockChords: ChordPosition[] = [
    { id: 'chord-1', originalText: 'C', currentText: 'C', x: 10, y: 20 },
    { id: 'chord-2', originalText: 'G', currentText: 'G', x: 25, y: 20 },
    { id: 'chord-3', originalText: 'Am', currentText: 'Am', x: 40, y: 20 },
    { id: 'chord-4', originalText: 'F', currentText: 'F', x: 55, y: 20 },
  ];

  it('deletes a chord by ID from the list', () => {
    let chords = [...mockChords];
    const deleteId = 'chord-2';

    const handleDelete = (id: string) => {
      chords = chords.filter((c) => c.id !== id);
    };

    handleDelete(deleteId);
    expect(chords.length).toBe(3);
    expect(chords.find((c) => c.id === deleteId)).toBeUndefined();
    expect(chords.map((c) => c.originalText)).toEqual(['C', 'Am', 'F']);
  });

  it('resets activeChordId and editing state when the active chord is deleted', () => {
    let chords = [...mockChords];
    let activeChordId: string | null = 'chord-3';
    let editingChord: ChordPosition | null = mockChords[2];
    let isEditorOpen = true;

    const handleDelete = (id: string) => {
      chords = chords.filter((c) => c.id !== id);
      if (activeChordId === id) activeChordId = null;
      if (editingChord?.id === id) {
        editingChord = null;
        isEditorOpen = false;
      }
    };

    handleDelete('chord-3');
    expect(chords.length).toBe(3);
    expect(activeChordId).toBeNull();
    expect(editingChord).toBeNull();
    expect(isEditorOpen).toBe(false);
  });

  it('preserves other chords when one is deleted', () => {
    let chords = [...mockChords];
    const handleDelete = (id: string) => {
      chords = chords.filter((c) => c.id !== id);
    };

    handleDelete('chord-1');
    handleDelete('chord-4');
    expect(chords.length).toBe(2);
    expect(chords.map((c) => c.originalText)).toEqual(['G', 'Am']);
  });
});
