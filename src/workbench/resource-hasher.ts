import type { ResourceContentHash } from "./contracts.js";

export interface EmbeddedResourceHasher {
  hash(bytes: Uint8Array): Promise<ResourceContentHash> | ResourceContentHash;
}
