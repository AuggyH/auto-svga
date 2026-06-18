import { createHash } from "node:crypto";
import type { ResourceContentHash } from "../workbench/contracts.js";
import type { EmbeddedResourceHasher } from "../workbench/resource-hasher.js";

export class Sha256ResourceHasher implements EmbeddedResourceHasher {
  hash(bytes: Uint8Array): ResourceContentHash {
    return {
      algorithm: "sha256",
      value: createHash("sha256").update(bytes).digest("hex"),
      scope: "encoded_bytes"
    };
  }
}
