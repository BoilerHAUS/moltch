import fs from "node:fs";

const ALLOWED_STATUS = new Set(["active", "deprecated", "removed"]);
const CODE_PATTERN = /^[a-z][a-z0-9_]*$/;

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

export const REASON_CODE_ERROR = Object.freeze({
  REGISTRY_INVALID: "ERR_REASON_CODE_REGISTRY_INVALID",
  CODE_UNKNOWN: "ERR_REASON_CODE_UNKNOWN",
  CODE_DEPRECATED: "ERR_REASON_CODE_DEPRECATED",
  CODE_REMOVED: "ERR_REASON_CODE_REMOVED"
});

export function validateRegistryShape(registry) {
  if (!registry || typeof registry !== "object") {
    throw fail(REASON_CODE_ERROR.REGISTRY_INVALID, "registry must be an object");
  }
  if (typeof registry.version !== "string" || !registry.version) {
    throw fail(REASON_CODE_ERROR.REGISTRY_INVALID, "registry.version is required");
  }
  if (!Array.isArray(registry.codes) || registry.codes.length === 0) {
    throw fail(REASON_CODE_ERROR.REGISTRY_INVALID, "registry.codes must be a non-empty array");
  }

  const seen = new Set();
  for (const entry of registry.codes) {
    if (!entry || typeof entry !== "object") {
      throw fail(REASON_CODE_ERROR.REGISTRY_INVALID, "registry code entry must be an object");
    }
    if (typeof entry.code !== "string" || !CODE_PATTERN.test(entry.code)) {
      throw fail(REASON_CODE_ERROR.REGISTRY_INVALID, `invalid reason code: ${entry.code}`);
    }
    if (seen.has(entry.code)) {
      throw fail(REASON_CODE_ERROR.REGISTRY_INVALID, `duplicate reason code: ${entry.code}`);
    }
    seen.add(entry.code);

    if (!ALLOWED_STATUS.has(entry.status)) {
      throw fail(REASON_CODE_ERROR.REGISTRY_INVALID, `invalid status for ${entry.code}: ${entry.status}`);
    }

    if (entry.status === "deprecated" && typeof entry.replacement !== "string") {
      throw fail(REASON_CODE_ERROR.REGISTRY_INVALID, `deprecated code requires replacement: ${entry.code}`);
    }
  }

  return true;
}

export function loadReasonCodeRegistry(pathOrUrl = new URL("../data/reason-code-registry.v1.json", import.meta.url)) {
  const raw = fs.readFileSync(pathOrUrl, "utf8");
  const parsed = JSON.parse(raw);
  validateRegistryShape(parsed);
  return parsed;
}

export function buildReasonCodeIndex(registry) {
  validateRegistryShape(registry);
  return new Map(registry.codes.map((entry) => [entry.code, entry]));
}

export function assertReasonCodeAllowed(reasonCode, index, options = {}) {
  const entry = index.get(reasonCode);
  if (!entry) {
    throw fail(REASON_CODE_ERROR.CODE_UNKNOWN, `unknown reason code: ${reasonCode}`);
  }

  if (entry.status === "removed") {
    throw fail(REASON_CODE_ERROR.CODE_REMOVED, `removed reason code: ${reasonCode}`);
  }

  if (entry.status === "deprecated" && !options.allowDeprecated) {
    const replacement = entry.replacement ? ` (replacement: ${entry.replacement})` : "";
    throw fail(REASON_CODE_ERROR.CODE_DEPRECATED, `deprecated reason code: ${reasonCode}${replacement}`);
  }

  return entry;
}
