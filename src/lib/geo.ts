export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

/** Distância em linha reta (Haversine) entre dois pontos, em km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function isValidLatLng(v: unknown): v is LatLng {
  if (!v || typeof v !== "object") return false;
  const { lat, lng } = v as Record<string, unknown>;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** Rótulo curto do ponto de referência (ex: "UNIFEI"). */
export function shortOriginLabel(origin: string): string {
  const acronym = origin.match(/\b[A-Z]{3,}\b/);
  if (acronym) return acronym[0];
  return origin.split(/[,-]/)[0].trim().slice(0, 28);
}
