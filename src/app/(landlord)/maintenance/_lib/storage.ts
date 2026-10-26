// D-15 · a landlord's files live at `<landlord_id>/<document_id>` in the private `documents`
// bucket. The server signs URLs with the service role, so before it signs one it checks the path
// is exactly that: RLS proves a `document` row is the landlord's, not that its free-text
// `storage_path` points at the landlord's own object.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** The only storage path a landlord's document may have. */
export function ownStoragePath(landlordId: string, documentId: string): string {
  return `${landlordId}/${documentId}`;
}

export function isOwnStoragePath(landlordId: string, document: { id: string; storage_path: string }): boolean {
  return isUuid(landlordId) && isUuid(document.id) && document.storage_path === ownStoragePath(landlordId, document.id);
}
