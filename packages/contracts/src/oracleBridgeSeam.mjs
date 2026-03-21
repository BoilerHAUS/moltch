import fs from "node:fs";

export function loadOracleBridgeSeamInterface(pathOrUrl = new URL("../interfaces/oracle-bridge-seam.interface.json", import.meta.url)) {
  return JSON.parse(fs.readFileSync(pathOrUrl, "utf8"));
}

export function validateOracleBridgeInterface(iface) {
  if (!iface?.name || !iface?.version) {
    throw new Error("ERR_INVALID_ORACLE_BRIDGE_INTERFACE");
  }
  if (!Array.isArray(iface.states) || iface.states.length === 0) {
    throw new Error("ERR_INVALID_ORACLE_BRIDGE_INTERFACE");
  }
  if (!Array.isArray(iface.requestRequiredFields) || !Array.isArray(iface.approvalRequiredFields) || !Array.isArray(iface.resultRequiredFields)) {
    throw new Error("ERR_INVALID_ORACLE_BRIDGE_INTERFACE");
  }
  return true;
}
