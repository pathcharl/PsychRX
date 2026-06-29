/**
 * tsx/Node shim: React 18 stable does not export `cache` (Next injects it at
 * runtime). Several lib modules call `cache(...)` at import time, which throws
 * "cache is not a function" under plain tsx. Patch the original react exports
 * with an identity cache so these modules can be imported in scripts.
 *
 * IMPORTANT: import this file FIRST, before any "@/lib/*" import.
 */
import { createRequire } from "node:module";

const req = createRequire(process.cwd() + "/_cache-shim.js");
const react = req("react") as { cache?: <T>(fn: T) => T };
if (typeof react.cache !== "function") {
  react.cache = (fn) => fn;
}
