const countries = require('../data/countries.json');

function bboxOf(coordsFlat) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  coordsFlat.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  return [minX, minY, maxX, maxY];
}

function flattenRings(geometry) {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.flat(1);
  }
  return geometry.coordinates.flat(2);
}

const indexed = countries.features.map((feature) => ({
  name: feature.properties.name,
  geometry: feature.geometry,
  bbox: bboxOf(flattenRings(feature.geometry)),
}));

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygonCoords(x, y, polygonCoords) {
  if (!pointInRing(x, y, polygonCoords[0])) return false;
  for (let k = 1; k < polygonCoords.length; k += 1) {
    if (pointInRing(x, y, polygonCoords[k])) return false;
  }
  return true;
}

function pointInGeometry(x, y, geometry) {
  if (geometry.type === 'Polygon') {
    return pointInPolygonCoords(x, y, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polyCoords) => pointInPolygonCoords(x, y, polyCoords));
  }
  return false;
}

function countryAt(lat, lng) {
  const x = lng;
  const y = lat;
  for (const entry of indexed) {
    const [minX, minY, maxX, maxY] = entry.bbox;
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    if (pointInGeometry(x, y, entry.geometry)) return entry.name;
  }
  return null;
}

module.exports = { countryAt };
