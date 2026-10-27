// S-04 · Photo uploader. Screens import from "@/components/upload".
//
//   const transport = useMemo(() => signedUrlTransport(signMyPhoto), []);   // the screen's server action
//   const { queue, busy } = useUploadQueue({ max: TENANT_PHOTO_LIMIT, transport, altFor });
//   <PhotoUploader queue={queue} label="Add a photo" />
//   on submit: show UPLOAD_MESSAGES.uploading while `await queue.whenSettled()`, then send `queue.refs`.
export { PhotoUploader, focusFirstFailedPhoto, type PhotoUploaderProps } from "./photo-uploader";
export { UploadQueue, type PhotoStatus, type QueuedPhoto, type UploadQueueOptions } from "./queue";
export { useQueueState, useUploadQueue, type UploadQueueState } from "./use-upload-queue";
export {
  putWithProgress,
  signedUrlTransport,
  type SignedUpload,
  type UploadContext,
  type UploadResult,
  type UploadSigner,
  type UploadTransport,
} from "./transport";
export { preparePhoto, sniffKind, type PhotoKind, type Prepared } from "./prepare";
export {
  LANDLORD_PHOTO_LIMIT,
  MAX_ORIGINAL_BYTES,
  PHOTO_ACCEPT,
  TARGET_BYTES,
  TENANT_PHOTO_LIMIT,
  UPLOAD_MESSAGES,
} from "./limits";
