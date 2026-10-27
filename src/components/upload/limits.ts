// S-04 · Photo uploader — limits and wording. Client-safe constants shared by every screen that
// uses the uploader (T01-UPL-PHOTO, L07-UPL-AFTER †, L09-FRM-ADDTENANT †, L13-TBL-DEDUCTIONS,
// L15-UPL-LOGO).

/** S-04 rules: "Maximum 3 photos on tenant screens, 10 on landlord screens." */
export const TENANT_PHOTO_LIMIT = 3;
export const LANDLORD_PHOTO_LIMIT = 10;

/** Decisions §9: 10 MB before compression is a build constant (also the bucket's file_size_limit). */
export const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;

/** S-04: "A 6MB phone photo should leave as roughly 400KB." */
export const TARGET_BYTES = 400 * 1024;
/** Long edge of the photo that leaves the device. Enough to read a meter or a crack. */
export const LONG_EDGE_PX = 1600;
/** A photo that will not come down to the target at LONG_EDGE_PX gets one smaller pass. */
export const FALLBACK_EDGE_PX = 1280;

/** Decisions §9: JPEG, PNG, HEIC, WebP. HEIF is HEIC's container name on some Android phones. */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/heic,image/heif,image/webp,.heic,.heif";

/** No upload progress for this long means the connection has stalled; the photo shows Retry. */
export const STALL_MS = 30_000;
/** Uploads in flight at once. Two keeps a weak 4G link busy without starving the first photo. */
export const UPLOAD_CONCURRENCY = 2;

export const UPLOAD_MESSAGES = {
  /** S04-ERR */
  tooLarge: "That file is too large",
  /** S04-ERR */
  notSupported: "That file type is not supported",
  /** Network failure or stall, on the thumbnail with Retry. Not in E1; kept short for a 112px tile. */
  failed: "Upload failed",
  /** S-04 rules: the submit button while it waits. */
  uploading: "Uploading photo…",
} as const;
