import { describe, it, expect } from "vitest";
import {
  getDocumentData,
  type TypedDocumentSnapshot,
  type DocumentData,
} from "./index.js";

function makeSnapshot<T extends DocumentData>(
  id: string,
  exists: boolean,
  docData?: T
): TypedDocumentSnapshot<T> {
  return {
    id,
    exists,
    data: () => docData,
  };
}

describe("getDocumentData", () => {
  it("returns data for an existing document", () => {
    const snapshot = makeSnapshot("doc1", true, { name: "Alice", age: 30 });
    const data = getDocumentData(snapshot);
    expect(data).toEqual({ name: "Alice", age: 30 });
  });

  it("throws when the document does not exist", () => {
    const snapshot = makeSnapshot("doc2", false);
    expect(() => getDocumentData(snapshot)).toThrow(
      'Document "doc2" does not exist.'
    );
  });

  it("throws when data() returns undefined even though exists is true", () => {
    const snapshot: TypedDocumentSnapshot<DocumentData> = {
      id: "doc3",
      exists: true,
      data: () => undefined,
    };
    expect(() => getDocumentData(snapshot)).toThrow(
      'Document "doc3" returned no data.'
    );
  });
});
