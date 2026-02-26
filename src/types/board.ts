export type RouteType = 'shinkansen' | 'local' | 'ferry';

export type SquareType =
  | 'property'    // 物件マス
  | 'card'        // カードマス
  | 'shop'        // カード売り場
  | 'destination' // 目的地マス（動的に設定）
  | 'event'       // イベントマス
  | 'normal';     // 通常マス

export type RegionType =
  | 'hokkaido'
  | 'tohoku'
  | 'kanto'
  | 'chubu'
  | 'kinki'
  | 'chugoku'
  | 'shikoku'
  | 'kyushu_okinawa';

export interface City {
  id: string;
  name: string;
  prefecture: string;
  region: RegionType;
  lat: number;
  lng: number;
}

export interface Square {
  id: string;
  type: SquareType;
  cityId?: string; // 都市に属するマスの場合
}

export interface Route {
  id: string;
  fromCityId: string;
  toCityId: string;
  routeType: RouteType;
  squares: SquareType[]; // 2都市間のマス目構成
}

export interface Board {
  cities: City[];
  routes: Route[];
}
