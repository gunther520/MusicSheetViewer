/**
 * Character table for the public English PP-OCRv4 rec CNN
 * (HuggingFace cycloneboy/en_PP-OCRv4_rec_infer `en_dict.txt`, 95 glyphs).
 * CTC blank is index 0 at decode time; these glyphs start at index 1.
 * Never replace this with a charset fitted on this repo's sheet photos.
 */
export const PPOCR_EN_DICT = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  ':', ';', '<', '=', '>', '?', '@',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '[', '\\', ']', '^', '_', '`',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '{', '|', '}', '~',
  '!', '"', '#', '$', '%', '&', '\'', '(', ')', '*', '+', ',', '-', '.', '/',
  ' ',
] as const;

export const PPOCR_EN_CLASS_COUNT = PPOCR_EN_DICT.length + 1;
