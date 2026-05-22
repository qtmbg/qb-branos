// Shared constants for the Asset Layer · chapter 3 step 3.
// Matches migration 019 bucket config + qb-file-upload.js client-side.
// Single source of truth so the three layers (DB bucket · server · client)
// stay in lockstep.

export const BUCKET = 'user-uploads';

// 25 MB · flat across all tiers (Call 5 sharpened adjudication).
// PL-003 later raises per tier from this baseline.
export const FILE_SIZE_LIMIT_BYTES = 26214400;

// Phase 02 baseline. Video/audio waits for chapter 5.
export const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/webp',
  'application/pdf',
]);

// 1-hour signed URL TTL (Call 4 default).
export const SIGNED_URL_TTL_SECONDS = 3600;

// UUID v4 path-segment regex. Used to validate that a path's first folder
// segment looks like a Supabase user id.
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Path layout: user-uploads/{user_id}/{file_id}.{ext}
// Returns { userId, fileSegment } on valid path, null on invalid.
export function parseUserUploadPath(path) {
  if (typeof path !== 'string' || !path) return null;
  // Strip leading bucket prefix if present (callers may pass either form).
  const stripped = path.startsWith(`${BUCKET}/`) ? path.slice(BUCKET.length + 1) : path;
  const parts = stripped.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  const [userId, fileSegment] = parts;
  if (!UUID_RE.test(userId)) return null;
  if (!fileSegment || fileSegment.length > 256 || fileSegment.includes('..')) return null;
  return { userId, fileSegment, objectName: `${userId}/${fileSegment}` };
}

// Derive a canonical mime type from the file extension. Only handles the
// ALLOWED_MIME_TYPES set; other extensions resolve to null (caller decides
// how to surface that · usually a 400 / refuse).
const EXT_TO_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  pdf: 'application/pdf',
};
export function mimeFromExt(filePath) {
  if (typeof filePath !== 'string') return null;
  const dot = filePath.lastIndexOf('.');
  if (dot < 0 || dot === filePath.length - 1) return null;
  const ext = filePath.slice(dot + 1).toLowerCase();
  return EXT_TO_MIME[ext] || null;
}

// Strip the extension from a file segment to get the canonical file_id.
// Returns null if the segment has no extension.
export function fileIdFromSegment(fileSegment) {
  if (typeof fileSegment !== 'string') return null;
  const dot = fileSegment.lastIndexOf('.');
  if (dot <= 0) return null;
  return fileSegment.slice(0, dot);
}
