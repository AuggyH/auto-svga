import { mountProductShell } from "../shared/product-frontend/product-shell-loader.mjs";

await mountProductShell();
await import("../shared/product-frontend/short-term-product-app.mjs");
