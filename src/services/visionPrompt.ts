/**
 * App-side re-export of Vision prompts.
 * Canonical copy lives in api/ so the Vercel function never imports the Vite src graph.
 */
export {
  VISION_BAND_MONTAGE_SYSTEM_PROMPT,
  VISION_BAND_MONTAGE_USER_TEXT,
  VISION_DETECTION_SYSTEM_PROMPT,
  VISION_FULL_SHEET_USER_TEXT,
  resolveVisionPrompts,
  type VisionSheetLayout,
} from '../../api/visionPrompts';
