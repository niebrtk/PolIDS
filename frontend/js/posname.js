// Nazwy stanowisk jak w VACS: EPWW_DBF_CTR → EPWW DBF, EDMM_MEI_CTR → EDMM MEI, EPPO_N_APP → PO N APP, EPWA_TWR → WA TWR.
// CTR/FSS bez typu; polskie lotniska bez "EP" (poza EPWW); pozostałe: prefiks, środek i typ.
const NO_TYPE = ["CTR", "FSS"];
const TYPES = ["CTR", "FSS", "APP", "DEP", "TWR", "GND", "DEL", "ATIS", "FMP", "TMU", "RMP", "FIS", "DIR"];

export function posName(callsign) {
  const parts = String(callsign || "").toUpperCase().split("_").filter(Boolean);
  if (parts.length < 2) return parts.join(" ");
  const type = TYPES.includes(parts[parts.length - 1]) ? parts.pop() : null;
  let [prefix, ...mid] = parts;
  if (type && NO_TYPE.includes(type)) return [prefix, ...mid].join(" ");
  if (prefix.startsWith("EP") && prefix !== "EPWW" && prefix.length === 4) prefix = prefix.slice(2);
  return [prefix, ...mid, ...(type ? [type] : [])].join(" ");
}
