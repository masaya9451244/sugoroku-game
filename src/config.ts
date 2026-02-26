// ゲーム設定・定数

export const GAME_CONFIG = {
  WIDTH: 1280,
  HEIGHT: 720,
  MAX_PLAYERS: 4,
  MAX_CARD_COUNT: 8,
  MONOPOLY_BONUS_MULTIPLIER: 2,
} as const;

export const SCENE_KEYS = {
  BOOT: 'SCENE_BOOT',
  PRELOAD: 'SCENE_PRELOAD',
  TITLE: 'SCENE_TITLE',
  PLAYER_SETUP: 'SCENE_PLAYER_SETUP',
  GAME: 'SCENE_GAME',
  OVERLAY: 'SCENE_OVERLAY',
  RESULT: 'SCENE_RESULT',
} as const;

export const COLORS = {
  PRIMARY: 0xff6b35,
  SECONDARY: 0x4ecdc4,
  BACKGROUND: 0xfff9f0,
  TEXT_PRIMARY: 0x333333,
  TEXT_WHITE: 0xffffff,
  DANGER: 0xe74c3c,
  SUCCESS: 0x27ae60,
  GOLD: 0xf1c40f,
} as const;

export const FONTS = {
  PRIMARY: 'Arial',
  SIZE: {
    SM: 14,
    MD: 18,
    LG: 24,
    XL: 32,
    XXL: 48,
  },
} as const;

export const ANIMATION = {
  DICE_ROLL_DURATION: 1000,
  MOVE_PER_SQUARE: 200,
  OVERLAY_FADE_IN: 300,
  OVERLAY_FADE_OUT: 200,
  BOMBEE_APPEAR: 800,
  DESTINATION_BONUS: 1200,
} as const;

export const BOMBEE = {
  MINI_TO_NORMAL_TURNS: 5,
  NORMAL_TO_KING_TURNS: 10,
} as const;

export const SAVE_KEYS = {
  SLOT_PREFIX: 'sugoroku_save_slot_',
  METADATA: 'sugoroku_save_metadata',
  VERSION: '1.0.0',
} as const;

/** カード売り場がある主要都市 */
export const SHOP_CITY_IDS: readonly string[] = [
  'sapporo', 'sendai', 'tokyo', 'nagoya', 'osaka',
  'hiroshima', 'fukuoka', 'naha', 'kanazawa', 'niigata',
] as const;
