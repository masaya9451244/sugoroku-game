import type { City, Route, Board, SquareType } from '../types';
import { latLngToCanvas, getSquarePositions } from '../utils/mapUtils';
import type { MapArea } from '../utils/mapUtils';

export interface MoveResult {
  type: 'arrived' | 'junction' | 'in_transit';
  cityId?: string;
  routeId?: string;
  squareIndex?: number;
  squareType?: SquareType;
  junctionRoutes?: Route[];
  remainingSteps?: number;
}

export interface SquarePosition {
  routeId: string;
  squareIndex: number; // 0-based index in route.squares
  x: number;
  y: number;
  type: SquareType;
  cityId?: string; // 都市マスの場合
}

export class BoardManager {
  private cities: Map<string, City> = new Map();
  private routes: Route[] = [];
  private cityRoutes: Map<string, Route[]> = new Map(); // cityId → routes

  loadData(board: Board): void {
    this.cities.clear();
    this.routes = board.routes;
    this.cityRoutes.clear();

    for (const city of board.cities) {
      this.cities.set(city.id, city);
      this.cityRoutes.set(city.id, []);
    }

    for (const route of board.routes) {
      this.cityRoutes.get(route.fromCityId)?.push(route);
      this.cityRoutes.get(route.toCityId)?.push(route);
    }
  }

  getCityById(id: string): City | undefined {
    return this.cities.get(id);
  }

  getAllCities(): City[] {
    return Array.from(this.cities.values());
  }

  getAllRoutes(): Route[] {
    return this.routes;
  }

  /**
   * 指定都市から出ている全路線を返す
   */
  getRoutesFromCity(cityId: string): Route[] {
    return this.cityRoutes.get(cityId) ?? [];
  }

  /**
   * 指定都市から直接接続している隣接都市を返す
   */
  getAdjacentCities(cityId: string): City[] {
    const routes = this.getRoutesFromCity(cityId);
    const adjacentIds = routes.map((r) =>
      r.fromCityId === cityId ? r.toCityId : r.fromCityId,
    );
    return adjacentIds
      .map((id) => this.cities.get(id))
      .filter((c): c is City => c !== undefined);
  }

  /**
   * 路線の反対側の都市IDを返す
   */
  getOtherCityId(route: Route, fromCityId: string): string {
    return route.fromCityId === fromCityId ? route.toCityId : route.fromCityId;
  }

  /**
   * 都市のキャンバス座標を返す
   */
  getCityCanvasPos(cityId: string, mapArea: MapArea): { x: number; y: number } | undefined {
    const city = this.cities.get(cityId);
    if (!city) return undefined;
    return latLngToCanvas(city.lat, city.lng, mapArea);
  }

  /**
   * 全路線上のマス目のキャンバス座標を計算する
   */
  getAllSquarePositions(mapArea: MapArea): SquarePosition[] {
    const positions: SquarePosition[] = [];

    for (const route of this.routes) {
      const fromCity = this.cities.get(route.fromCityId);
      const toCity = this.cities.get(route.toCityId);
      if (!fromCity || !toCity) continue;

      const fromPos = latLngToCanvas(fromCity.lat, fromCity.lng, mapArea);
      const toPos = latLngToCanvas(toCity.lat, toCity.lng, mapArea);
      const squarePositions = getSquarePositions(fromPos, toPos, route.squares.length);

      for (let i = 0; i < route.squares.length; i++) {
        positions.push({
          routeId: route.id,
          squareIndex: i,
          x: squarePositions[i].x,
          y: squarePositions[i].y,
          type: route.squares[i],
        });
      }
    }

    return positions;
  }

  /**
   * 目的地候補（全都市）からランダムに1つ選ぶ（除外都市を指定可能）
   */
  getRandomDestination(excludeCityId?: string): City | undefined {
    const candidates = Array.from(this.cities.values()).filter(
      (c) => c.id !== excludeCityId,
    );
    if (candidates.length === 0) return undefined;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}
