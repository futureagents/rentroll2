// D-15 / E4-5: the service role signs a document's URL only when its path is the landlord's own
// `<landlord_id>/<document_id>`. A landlord-owned row pointing at another landlord's object is
// refused.
import { describe, expect, it } from "vitest";

import { isOwnStoragePath, ownStoragePath } from "../../src/app/(landlord)/maintenance/_lib/storage";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const DOC = "33333333-3333-4333-8333-333333333333";
const OTHER_DOC = "44444444-4444-4444-8444-444444444444";

describe("isOwnStoragePath", () => {
  it("accepts exactly <landlord_id>/<document_id>", () => {
    expect(isOwnStoragePath(A, { id: DOC, storage_path: ownStoragePath(A, DOC) })).toBe(true);
  });

  it("refuses another landlord's object, even on the landlord's own row", () => {
    expect(isOwnStoragePath(A, { id: DOC, storage_path: `${B}/${DOC}` })).toBe(false);
    expect(isOwnStoragePath(A, { id: DOC, storage_path: `${B}/${OTHER_DOC}` })).toBe(false);
  });

  it("refuses a different document under the landlord's prefix, traversal and junk", () => {
    expect(isOwnStoragePath(A, { id: DOC, storage_path: `${A}/${OTHER_DOC}` })).toBe(false);
    expect(isOwnStoragePath(A, { id: DOC, storage_path: `${A}/../${B}/${DOC}` })).toBe(false);
    expect(isOwnStoragePath(A, { id: DOC, storage_path: `${A}/${DOC}/x` })).toBe(false);
    expect(isOwnStoragePath(A, { id: "not-a-uuid", storage_path: `${A}/not-a-uuid` })).toBe(false);
  });
});
