export function calculateDistanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const earthRadiusM = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  return earthRadiusM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
