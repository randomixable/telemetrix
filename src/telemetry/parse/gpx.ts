import type { TrackPoint } from '../../types/telemetry'

function textContent(node: Element, tagName: string) {
  return node.getElementsByTagName(tagName)[0]?.textContent ?? undefined
}

export function parseGpxPoints(fileName: string, gpxText: string): TrackPoint[] {
  const doc = new DOMParser().parseFromString(gpxText, 'application/xml')
  const parserError = doc.getElementsByTagName('parsererror')[0]
  if (parserError) throw new Error('Invalid GPX file')

  const trackPoints = Array.from(doc.getElementsByTagName('trkpt'))
  if (!trackPoints.length) throw new Error('No GPX track points found')

  return trackPoints.map((trackPoint, index): TrackPoint => {
    const lat = Number(trackPoint.getAttribute('lat'))
    const lon = Number(trackPoint.getAttribute('lon'))
    const eleText = textContent(trackPoint, 'ele')
    const time = textContent(trackPoint, 'time')

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !time) {
      throw new Error(`Invalid GPX track point at index ${index}`)
    }

    return {
      id: `${fileName}-${index}`,
      lat,
      lon,
      ele: eleText ? Number(eleText) : undefined,
      time,
      origin: 'derived',
    }
  })
}
