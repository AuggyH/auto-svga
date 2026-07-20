import { mountProductShell } from "../shared/product-frontend/product-shell-loader.mjs";

await mountProductShell();
await import("../shared/product-frontend/product-app.mjs");
