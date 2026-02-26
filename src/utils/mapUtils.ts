// 日本地図の緯度経度 → キャンバス座標変換

const MAP_BOUNDS = {
  minLat: 24.0,
  maxLat: 46.0,
  minLng: 122.0,
  maxLng: 147.0,
};

export interface MapArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 緯度経度をキャンバス上のピクセル座標に変換する
 */
export function latLngToCanvas(lat: number, lng: number, mapArea: MapArea): { x: number; y: number } {
  const { minLat, maxLat, minLng, maxLng } = MAP_BOUNDS;
  const x = mapArea.x + ((lng - minLng) / (maxLng - minLng)) * mapArea.width;
  const y = mapArea.y + (1 - (lat - minLat) / (maxLat - minLat)) * mapArea.height;
  return { x, y };
}

/**
 * 2点間の中間座標を計算（路線上のマス目位置に使用）
 */
export function interpolate(
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

/**
 * 路線上のマス目のキャンバス座標を計算する
 * squares の各マス目が等間隔に並ぶ位置を返す
 */
export function getSquarePositions(
  fromPos: { x: number; y: number },
  toPos: { x: number; y: number },
  squareCount: number,
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < squareCount; i++) {
    const t = (i + 1) / (squareCount + 1);
    positions.push(interpolate(fromPos, toPos, t));
  }
  return positions;
}
