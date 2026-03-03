import Phaser from 'phaser';
import { SCENE_KEYS, COLORS, FONTS, ANIMATION, GAME_CONFIG, LAYOUT } from '../config';
import type { GameConfig, GameState, Player, Position, GameEvent } from '../types';
import type { City, Route } from '../types';
import type { Card } from '../types';
import { BoardManager } from '../game/BoardManager';
import { PropertyManager } from '../game/PropertyManager';
import { CardManager } from '../game/CardManager';
import { BombeeManager } from '../game/BombeeManager';
import { EventManager } from '../game/EventManager';
import { CpuManager } from '../game/CpuManager';
import type { RouteChoice } from '../game/CpuManager';
import { DestinationManager } from '../game/DestinationManager';
import type { MapArea } from '../utils/mapUtils';
import { rollDice } from '../utils/random';
import { formatManEn } from '../utils/format';
import type { OverlayScene, PropertySelectData, BankruptcyData, CityInfoData } from './OverlayScene';

const MAP_AREA: MapArea = { x: 0, y: LAYOUT.TOPBAR_H, width: 1280, height: 648 };
const CITY_DOT_RADIUS = 4;
const PAWN_RADIUS = 11;

const ROUTE_COLORS: Record<string, number> = {
  shinkansen: 0xff6600,  // オレンジ（新幹線・桃鉄スタイル）
  local: 0x90a4ae,       // グレー（在来線・デフォルト）
  ferry: 0x00bcd4,       // 明るい青（フェリー）
};

const REGION_ROUTE_COLORS: Record<string, number> = {
  hokkaido: 0x9c27b0,       // 紫
  tohoku: 0x2196f3,          // 青
  kanto: 0xf44336,           // 赤
  chubu: 0xff9800,           // オレンジ
  kinki: 0x4caf50,           // 緑
  chugoku: 0x009688,         // ティール
  shikoku: 0xe91e63,         // ピンク
  kyushu_okinawa: 0x795548,  // ブラウン
};

const MAJOR_CITY_IDS = new Set([
  // 北海道
  'sapporo', 'hakodate', 'asahikawa', 'kushiro',
  // 東北
  'aomori', 'akita', 'sendai', 'morioka',
  // 関東
  'tokyo', 'yokohama', 'chiba', 'utsunomiya',
  // 中部
  'niigata', 'nagano', 'nagoya', 'kanazawa', 'hamamatsu', 'shizuoka',
  // 近畿
  'osaka', 'kyoto', 'kobe', 'nara', 'wakayama',
  // 中国
  'hiroshima', 'okayama', 'matsue',
  // 四国
  'takamatsu', 'matsuyama', 'kochi',
  // 九州沖縄
  'fukuoka', 'kitakyushu', 'nagasaki', 'kumamoto', 'kagoshima', 'miyazaki', 'naha',
]);

const ROUTE_TYPE_NAMES: Record<string, string> = {
  shinkansen: '新幹線',
  local: '在来線',
  ferry: 'フェリー',
};

const PAWN_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12];


export class GameScene extends Phaser.Scene {
  private boardManager!: BoardManager;
  private propertyManager!: PropertyManager;
  private cardManager!: CardManager;
  private bombeeManager!: BombeeManager;
  private eventManager!: EventManager;
  private cpuManager!: CpuManager;
  private destinationManager!: DestinationManager;
  private gameState!: GameState;

  // コマ（Container で円＋ラベルを一体化）
  private pawnContainers: Phaser.GameObjects.Container[] = [];
  // 上部トップバーのUI要素
  private topBarPlayerDot!: Phaser.GameObjects.Arc;
  private topBarPlayerName!: Phaser.GameObjects.Text;
  private topBarCurrentCity!: Phaser.GameObjects.Text;
  private topBarDestInfo!: Phaser.GameObjects.Text;
  private topBarMoney!: Phaser.GameObjects.Text;
  private topBarYear!: Phaser.GameObjects.Text;
  private topBarMonth!: Phaser.GameObjects.Text;
  // アクションパネルのボタン
  private diceButton!: Phaser.GameObjects.Rectangle;
  private diceButtonLabel!: Phaser.GameObjects.Text;

  // マップマーカー
  private destinationMarker: Phaser.GameObjects.Container | null = null;
  private bombeeMarker: Phaser.GameObjects.Container | null = null;
  private propertyDotContainers: Phaser.GameObjects.Container[] = [];
  // 分岐選択UI（表示中のもの）
  private junctionUI: Phaser.GameObjects.Container | null = null;
  // カードドロー済みフラグ（1移動につき1枚まで）
  private cardDrawnThisMove = false;
  // plus_diceカードで加算するサイコロボーナス
  private extraDiceBonus = 0;
  // 新規ゲーム開始か（ロード時はfalse）
  private isNewGame = true;

  constructor() {
    super({ key: SCENE_KEYS.GAME });
  }

  /** OverlayScene への参照を安全に取得するゲッター */
  private get overlayScene(): OverlayScene {
    return this.scene.get(SCENE_KEYS.OVERLAY) as OverlayScene;
  }

  // ──────────────────────────────────────
  // 初期化
  // ──────────────────────────────────────

  init(data: { gameConfig?: GameConfig; gameState?: GameState }): void {
    this.boardManager = new BoardManager();
    this.propertyManager = new PropertyManager();
    this.cardManager = new CardManager();
    this.bombeeManager = new BombeeManager();
    this.eventManager = new EventManager();

    const citiesData = this.cache.json.get('cities') as City[];
    const routesData = this.cache.json.get('routes') as Route[];
    this.boardManager.loadData({ cities: citiesData, routes: routesData });
    this.cardManager.loadCards(this.cache.json.get('cards') ?? []);
    this.eventManager.loadEvents(this.cache.json.get('events') ?? []);

    this.cpuManager = new CpuManager(this.boardManager, this.propertyManager, this.cardManager);
    this.destinationManager = new DestinationManager(this.boardManager);

    this.isNewGame = !data.gameState;
    if (data.gameState) {
      this.gameState = data.gameState;
    } else {
      const config = data.gameConfig ?? {
        totalYears: 10,
        players: [
          { name: 'プレイヤー1', type: 'human', difficulty: 'normal' },
          { name: 'CPU', type: 'cpu', difficulty: 'normal' },
        ],
      };
      this.gameState = this.createInitialState(config);
    }

    // ボンビーを最下位プレイヤーに初期配置
    this.gameState = this.bombeeManager.attachBombeeToLastPlace(this.gameState);
  }

  create(): void {
    const { width, height } = this.scale;

    // 海（マップ全体の背景）
    this.add.rectangle(0, 0, width, height, COLORS.OCEAN).setOrigin(0);
    this.drawMap();

    this.createTopBar();
    this.createActionPanel();
    this.createPawns();
    this.updateMapMarkers();

    if (!this.scene.isActive(SCENE_KEYS.OVERLAY)) {
      this.scene.launch(SCENE_KEYS.OVERLAY);
    }

    // ゲーム開始演出：ダイスを無効化してバナー表示後に最初のターン開始
    this.setDiceButtonEnabled(false);
    this.time.delayedCall(400, () => this.startFirstTurn());
  }

  // ──────────────────────────────────────
  // マップ描画
  // ──────────────────────────────────────

  private drawMap(): void {
    const graphics = this.add.graphics();

    // 日本列島の輪郭をポリゴンで描画
    graphics.fillStyle(COLORS.LAND, 1);

    // lat/lng → キャンバス座標変換（新MAP_BOUNDS: minLng=127.5, range=19°）
    const c = (lat: number, lng: number) => ({
      x: MAP_AREA.x + ((lng - 127.5) / 19) * MAP_AREA.width,
      y: MAP_AREA.y + (1 - (lat - 24) / 22) * MAP_AREA.height,
    });

    // 島ポリゴン描画ヘルパー
    const drawIsland = (pts: { x: number; y: number }[]): void => {
      graphics.beginPath();
      graphics.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) graphics.lineTo(pts[i].x, pts[i].y);
      graphics.closePath();
      graphics.fillPath();
    };

    // 北海道
    drawIsland([
      c(41.8, 140.7), c(42.3, 140.3), c(43.0, 140.5), c(44.2, 141.7),
      c(45.4, 141.5), c(45.2, 143.5), c(44.3, 145.0), c(43.4, 145.3),
      c(43.0, 144.4), c(42.3, 143.3), c(41.8, 141.3),
    ]);

    // 本州
    drawIsland([
      // 太平洋側（N→SW）
      c(41.8, 141.0), c(41.5, 141.5), c(40.5, 141.8), c(39.0, 141.8),
      c(38.3, 141.3), c(36.5, 141.0), c(35.6, 140.8), c(35.0, 139.5),
      c(34.7, 138.5), c(34.6, 137.5), c(34.4, 136.5), c(33.5, 135.8),
      c(34.2, 135.0), c(34.5, 135.3), c(34.4, 134.0), c(34.3, 131.5),
      c(33.9, 130.9),
      // 日本海側（SW→N）
      c(34.2, 130.7), c(34.5, 131.5), c(35.5, 133.5), c(35.7, 134.5),
      c(36.3, 136.3), c(36.9, 137.2), c(37.5, 138.0), c(38.0, 139.3),
      c(39.5, 140.0), c(40.5, 140.3), c(41.3, 140.5),
    ]);

    // 四国
    drawIsland([
      c(34.2, 132.5), c(34.0, 132.8), c(33.6, 133.5), c(33.0, 133.8),
      c(32.9, 133.3), c(32.9, 132.5), c(33.3, 132.1),
    ]);

    // 九州
    drawIsland([
      c(33.9, 130.9), c(33.5, 131.4), c(33.0, 131.7), c(32.0, 131.4),
      c(31.5, 130.6), c(31.1, 130.5), c(31.2, 130.2), c(31.8, 129.8),
      c(32.5, 129.5), c(33.0, 129.7), c(33.5, 130.0), c(33.7, 130.5),
    ]);

    // 沖縄本島（小円で表現）
    const okinawa = c(26.2, 127.7);
    graphics.fillCircle(okinawa.x, okinawa.y, 15);

    // 路線を描画
    const citiesById = new Map(this.boardManager.getAllCities().map((c) => [c.id, c]));
    for (const route of this.boardManager.getAllRoutes()) {
      const fromPos = this.boardManager.getCityCanvasPos(route.fromCityId, MAP_AREA);
      const toPos = this.boardManager.getCityCanvasPos(route.toCityId, MAP_AREA);
      if (!fromPos || !toPos) continue;

      let color: number;
      let lineWidth: number;
      let alpha: number;
      if (route.routeType === 'shinkansen') {
        color = ROUTE_COLORS.shinkansen;
        lineWidth = 4.0;
        alpha = 1.0;
      } else if (route.routeType === 'ferry') {
        color = ROUTE_COLORS.ferry;
        lineWidth = 2.0;
        alpha = 0.8;
      } else {
        // 在来線：fromCityの地域カラーを使用
        const fromCity = citiesById.get(route.fromCityId);
        color = (fromCity ? REGION_ROUTE_COLORS[fromCity.region] : undefined) ?? 0x90a4ae;
        lineWidth = 2.0;
        alpha = 0.75;
      }

      graphics.lineStyle(lineWidth, color, alpha);
      graphics.beginPath();
      graphics.moveTo(fromPos.x, fromPos.y);
      graphics.lineTo(toPos.x, toPos.y);
      graphics.strokePath();
    }

    // 都市ドットとラベルを描画
    for (const city of this.boardManager.getAllCities()) {
      const pos = this.boardManager.getCityCanvasPos(city.id, MAP_AREA);
      if (!pos) continue;

      // ドット外枠（白）
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(pos.x, pos.y, CITY_DOT_RADIUS + 2);
      // ドット内（地域カラー）
      const dotColor = REGION_ROUTE_COLORS[city.region] ?? COLORS.PRIMARY;
      graphics.fillStyle(dotColor, 1);
      graphics.fillCircle(pos.x, pos.y, CITY_DOT_RADIUS);

      // 都市名ラベル（主要36都市のみ表示）
      if (MAJOR_CITY_IDS.has(city.id)) {
        this.add
          .text(pos.x + CITY_DOT_RADIUS + 3, pos.y, city.name, {
            fontFamily: FONTS.PRIMARY,
            fontSize: 9,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
          })
          .setOrigin(0, 0.5);
      }

      // 透明なヒットゾーン（都市クリックで物件情報を表示）
      const cityRef = city;
      const hitZone = this.add
        .rectangle(pos.x, pos.y, 26, 26, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', () => this.showCityInfoPopup(cityRef.id));
    }
  }

  /**
   * 都市クリック時に物件情報ポップアップを表示
   */
  private showCityInfoPopup(cityId: string): void {
    const city = this.boardManager.getCityById(cityId);
    if (!city) return;

    const REGION_NAMES: Record<string, string> = {
      hokkaido: '北海道', tohoku: '東北', kanto: '関東',
      chubu: '中部', kinki: '近畿', chugoku: '中国',
      shikoku: '四国', kyushu_okinawa: '九州・沖縄',
    };

    const cityProperties = this.propertyManager.getPropertiesByCity(
      this.gameState.properties, cityId,
    );

    const propertyInfos = cityProperties.map((prop) => {
      const owner = prop.ownerId
        ? this.gameState.players.find((p) => p.id === prop.ownerId)
        : null;
      return {
        property: prop,
        ownerName: owner?.name ?? null,
        ownerColor: owner?.color ?? null,
      };
    });

    const overlayScene = this.overlayScene;
    const cityInfoData: CityInfoData = {
      cityName: city.name,
      regionName: REGION_NAMES[city.region] ?? city.region,
      properties: propertyInfos,
      onClose: () => {},
    };
    overlayScene.events.emit('show_city_info', cityInfoData);
  }

  // ──────────────────────────────────────
  // UI構築
  // ──────────────────────────────────────

  private createTopBar(): void {
    const { width } = this.scale;
    const h = LAYOUT.TOPBAR_H;

    // 背景：濃い紺（青グラデーション）
    const bg = this.add.rectangle(0, 0, width, h, COLORS.HUD_BG).setOrigin(0);
    void bg;
    // 下部ゴールドライン
    this.add.rectangle(0, h - 2, width, 2, COLORS.GOLD).setOrigin(0);

    const row1Y = 18; // 上行Y
    const row2Y = 50; // 下行Y

    // プレイヤー色丸
    this.topBarPlayerDot = this.add.circle(16, h / 2, 10, PAWN_COLORS[0]);

    // プレイヤー名（左）
    this.topBarPlayerName = this.add.text(34, row1Y, '', {
      fontFamily: FONTS.PRIMARY,
      fontSize: 15,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5);

    // 現在地（左下）
    this.topBarCurrentCity = this.add.text(34, row2Y, '', {
      fontFamily: FONTS.PRIMARY,
      fontSize: 12,
      color: '#ccddff',
    }).setOrigin(0, 0.5);

    // 目的地情報（中央）
    this.topBarDestInfo = this.add.text(width / 2, h / 2, '', {
      fontFamily: FONTS.PRIMARY,
      fontSize: 14,
      color: '#' + COLORS.GOLD.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
    }).setOrigin(0.5);

    // 所持金テキスト（右寄り）
    this.topBarMoney = this.add.text(width - 240, row1Y, '', {
      fontFamily: FONTS.PRIMARY,
      fontSize: 16,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    // N年目テキスト
    this.topBarYear = this.add.text(width - 100, row1Y, '', {
      fontFamily: FONTS.PRIMARY,
      fontSize: 13,
      color: '#aaccff',
    }).setOrigin(0.5, 0.5);

    // 大きい月数字（右端）
    this.topBarMonth = this.add.text(width - 60, h / 2, '', {
      fontFamily: FONTS.PRIMARY,
      fontSize: 44,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000044',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // 月ラベル（右端小）
    this.add.text(width - 30, row2Y, '月', {
      fontFamily: FONTS.PRIMARY,
      fontSize: 13,
      color: '#aaccff',
    }).setOrigin(0, 1);

    // タイトルへボタン（右端最小）
    this.add
      .text(width - 4, 4, 'タイトルへ', {
        fontFamily: FONTS.PRIMARY,
        fontSize: 9,
        color: '#667788',
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(SCENE_KEYS.TITLE));

    this.updateTopBar();
  }

  /**
   * 左下アクションパネルを構築する（マップ上にオーバーレイ）。
   * サイコロ・カード・その他 の3ボタン構成。
   */
  private createActionPanel(): void {
    const { x, y, w } = LAYOUT.ACTION_PANEL;
    const BTN_H = 45;
    const BTN_GAP = 6;

    // パネル背景（半透明）
    const panelBg = this.add.rectangle(x, y, w, BTN_H * 3 + BTN_GAP * 4, 0x000033, 0.72)
      .setOrigin(0)
      .setDepth(20);
    // パネル外枠
    panelBg.setStrokeStyle(1, 0x334466);

    const cx = x + w / 2;

    // ── サイコロボタン ──
    const diceY = y + BTN_GAP + BTN_H / 2;
    this.diceButton = this.add
      .rectangle(cx, diceY, w - 8, BTN_H, COLORS.PRIMARY)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(21);
    this.diceButtonLabel = this.add
      .text(cx, diceY, '🎲 サイコロ', {
        fontFamily: FONTS.PRIMARY,
        fontSize: 16,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(22);
    this.diceButton.on('pointerover', () => this.diceButton.setFillStyle(0xcc0000));
    this.diceButton.on('pointerout', () => {
      if (this.diceButton.input?.enabled) this.diceButton.setFillStyle(COLORS.PRIMARY);
    });
    this.diceButton.on('pointerdown', () => this.onDiceButtonClick());

    // ── カードボタン ──
    const cardY = diceY + BTN_H + BTN_GAP;
    const cardBtn = this.add
      .rectangle(cx, cardY, w - 8, BTN_H, 0x8e44ad)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(21);
    this.add
      .text(cx, cardY, '🃏 カード', {
        fontFamily: FONTS.PRIMARY,
        fontSize: 15,
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(22);
    cardBtn.on('pointerover', () => cardBtn.setFillStyle(0x7d3c98));
    cardBtn.on('pointerout', () => cardBtn.setFillStyle(0x8e44ad));
    cardBtn.on('pointerdown', () => this.onCardButtonClick());

    // ── その他ボタン（全プレイヤー状況） ──
    const otherY = cardY + BTN_H + BTN_GAP;
    const otherBtn = this.add
      .rectangle(cx, otherY, w - 8, BTN_H, 0x555566)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(21);
    this.add
      .text(cx, otherY, '📊 その他', {
        fontFamily: FONTS.PRIMARY,
        fontSize: 15,
        color: '#cccccc',
      })
      .setOrigin(0.5)
      .setDepth(22);
    otherBtn.on('pointerover', () => otherBtn.setFillStyle(0x777788));
    otherBtn.on('pointerout', () => otherBtn.setFillStyle(0x555566));
    otherBtn.on('pointerdown', () => this.onOtherButtonClick());
  }

  private onOtherButtonClick(): void {
    const overlayScene = this.overlayScene;
    overlayScene.events.emit('show_player_status', {
      players: this.gameState.players,
      properties: this.gameState.properties,
      currentYear: this.gameState.currentYear,
      onClose: () => {},
    });
  }

  private createPawns(): void {
    this.gameState.players.forEach((player, i) => {
      const pos = this.boardManager.getCityCanvasPos(player.position.cityId, MAP_AREA);
      if (!pos) return;

      const offset = this.getPawnOffset(i);
      const circle = this.add.circle(0, 0, PAWN_RADIUS, PAWN_COLORS[i]);
      circle.setStrokeStyle(2, 0xffffff);
      const label = this.add
        .text(0, 0, `${i + 1}`, {
          fontFamily: FONTS.PRIMARY,
          fontSize: 9,
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      const container = this.add.container(
        pos.x + offset.x,
        pos.y + offset.y,
        [circle, label],
      );
      container.setDepth(10);
      this.pawnContainers.push(container);
    });
  }

  private getPawnOffset(index: number): { x: number; y: number } {
    const offsets = [
      { x: -8, y: -8 },
      { x: 8, y: -8 },
      { x: -8, y: 8 },
      { x: 8, y: 8 },
    ];
    return offsets[index] ?? { x: 0, y: 0 };
  }

  // ──────────────────────────────────────
  // カードUI
  // ──────────────────────────────────────

  private onCardButtonClick(): void {
    const player = this.gameState.players[this.gameState.currentPlayerIndex];
    const cards = this.cardManager.getPlayerHand(this.gameState, player.id);
    const overlayScene = this.overlayScene;
    overlayScene.events.emit('show_card_hand', {
      player,
      cards,
      onUseCard: (cardId: string) => this.handleCardUse(cardId),
      onDiscardCard: (cardId: string) => {
        const card = this.cardManager.getCardById(cardId);
        this.gameState = this.cardManager.discardCard(
          this.gameState, player.id, cardId,
        );
        this.updatePlayerPanel();
        if (card) this.showActionToast(`「${card.name}」を捨てました`);
      },
      onClose: () => {},
    });
  }

  private handleCardUse(cardId: string): void {
    const playerIndex = this.gameState.currentPlayerIndex;
    const player = this.gameState.players[playerIndex];
    const card = this.cardManager.getCardById(cardId);
    if (!card) return;

    // 物件売却カード（self_choice は物件選択、opponent_forced はプレイヤー選択）
    if (card.type === 'sell_property') {
      const targetType = card.effect.targetType;

      if (targetType === 'self_choice') {
        const ownedProps = this.gameState.properties.filter((p) => p.ownerId === player.id);
        if (ownedProps.length === 0) return;

        const overlayScene = this.overlayScene;
        const selectData: PropertySelectData = {
          title: '売却する物件を選んでください',
          properties: ownedProps,
          onSelect: (propertyId: string) => {
            this.applyCardEffect(cardId, {
              targetCityId: player.position.cityId,
              targetPropertyId: propertyId,
            });
          },
          onCancel: () => {},
        };
        overlayScene.events.emit('show_property_select', selectData);
        return;
      }

      if (targetType === 'opponent_forced') {
        const opponents = this.gameState.players.filter((p) => p.id !== player.id);
        if (opponents.length === 0) return;

        const overlayScene = this.overlayScene;
        overlayScene.events.emit('show_player_select', {
          title: '強制売却させるプレイヤーを選んでください',
          players: opponents,
          onSelect: (targetPlayerId: string) => {
            this.applyCardEffect(cardId, {
              targetCityId: player.position.cityId,
              targetPlayerId,
            });
          },
          onCancel: () => {},
        });
        return;
      }
    }

    // テレポートカード（move_steps / any_station）：都市選択ダイアログ
    if (card.type === 'move_steps' && card.effect.targetType === 'any_station') {
      const cities = this.boardManager.getAllCities().map((c) => ({ id: c.id, name: c.name }));
      const overlayScene = this.overlayScene;
      overlayScene.events.emit('show_city_select', {
        title: 'テレポート先を選んでください',
        cities,
        onSelect: (cityId: string) => {
          this.applyCardEffect(cardId, { targetCityId: cityId });
        },
        onCancel: () => {},
      });
      return;
    }

    // ボンビー強制移動（last_to_second）：対象自動選択、ダイアログ不要
    if (card.type === 'bombee_transfer' && card.effect.targetType === 'last_to_second') {
      this.applyCardEffect(cardId, {});
      return;
    }

    // プレイヤー選択が必要なカード（bombee_transfer / card_steal）
    if (card.type === 'bombee_transfer' || card.type === 'card_steal') {
      const opponents = this.gameState.players.filter((p) => p.id !== player.id);
      if (opponents.length === 0) return;

      const title =
        card.type === 'bombee_transfer'
          ? 'ボンビーを誰に移しますか？'
          : 'カードを誰から奪いますか？';
      const overlayScene = this.overlayScene;
      overlayScene.events.emit('show_player_select', {
        title,
        players: opponents,
        onSelect: (targetPlayerId: string) => {
          // selected_card: プレイヤー選択後にさらにカード選択ダイアログ
          if (card.type === 'card_steal' && card.effect.targetType === 'selected_card') {
            const targetPlayer = this.gameState.players.find((p) => p.id === targetPlayerId);
            const targetCards = this.cardManager.getPlayerHand(this.gameState, targetPlayerId);
            if (!targetPlayer || targetCards.length === 0) {
              this.applyCardEffect(cardId, { targetPlayerId });
              return;
            }
            overlayScene.events.emit('show_card_select', {
              title: `${targetPlayer.name} のカードを選んでください`,
              cards: targetCards,
              onSelect: (targetCardId: string) => {
                this.applyCardEffect(cardId, { targetPlayerId, targetCardId });
              },
              onCancel: () => {},
            });
            return;
          }
          this.applyCardEffect(cardId, { targetPlayerId });
        },
        onCancel: () => {},
      });
      return;
    }

    this.applyCardEffect(cardId, { targetCityId: player.position.cityId });
  }

  /**
   * カード効果を実際に適用する（handleCardUseから分離）
   */
  private applyCardEffect(
    cardId: string,
    options: {
      targetCityId?: string;
      targetPlayerId?: string;
      targetPropertyId?: string;
      targetCardId?: string;
    } = {},
  ): void {
    const playerIndex = this.gameState.currentPlayerIndex;
    const player = this.gameState.players[playerIndex];
    const card = this.cardManager.getCardById(cardId);

    const result = this.cardManager.useCard(this.gameState, player.id, cardId, {
      targetCityId: options.targetCityId ?? player.position.cityId,
      targetPlayerId: options.targetPlayerId,
      targetPropertyId: options.targetPropertyId,
      targetCardId: options.targetCardId,
    });

    if (!result.success || !result.newState) return;

    this.gameState = result.newState;
    this.updatePlayerPanel();

    // テレポート系カード（目的地 / 特定都市）
    if (card?.type === 'move_to_destination' || card?.type === 'move_to_city') {
      const newCityId = this.gameState.players[playerIndex].position.cityId;
      this.setDiceButtonEnabled(false);
      this.teleportPawn(playerIndex, newCityId, () => {
        this.onPlayerArrived(playerIndex, newCityId);
      });
      return;
    }

    // 歩数移動カード
    if (card?.type === 'move_steps') {
      this.setDiceButtonEnabled(false);
      // any_station: 選択した都市へテレポート
      if (card.effect.targetType === 'any_station' && options.targetCityId) {
        const destCityId = options.targetCityId;
        this.gameState = {
          ...this.gameState,
          players: this.gameState.players.map((p, idx) =>
            idx === playerIndex
              ? { ...p, position: { ...p.position, cityId: destCityId } }
              : p,
          ),
        };
        this.teleportPawn(playerIndex, destCityId, () => {
          this.onPlayerArrived(playerIndex, destCityId);
        });
        return;
      }
      const steps = card.effect.value ?? 3;
      if (steps > 0) {
        this.movePawnStepByStep(playerIndex, steps, () => {
          const p = this.gameState.players[playerIndex];
          this.onPlayerArrived(playerIndex, p.position.cityId);
        });
      } else {
        const backSteps = Math.abs(steps);
        this.movePawnBackward(playerIndex, backSteps, () => {
          const p = this.gameState.players[playerIndex];
          this.onPlayerArrived(playerIndex, p.position.cityId);
        });
      }
      return;
    }

    // サイコロ追加カード
    if (card?.type === 'plus_dice') {
      this.extraDiceBonus = card.effect.value ?? 1;
      // CPU はダイアログを出さず即続行（ダイアログが game.input.enabled=false のまま
      // 残るとフリーズするため）
      if (player.type === 'cpu') {
        this.updateCardInfo();
        return;
      }
      const overlayScene = this.overlayScene;
      overlayScene.events.emit('show_event', {
        title: card.name,
        description: `次のサイコロに +${this.extraDiceBonus} が加算されます！`,
        onClose: () => this.updateCardInfo(),
      });
      return;
    }

    // CPU はダイアログを出さず即続行（同上）
    if (player.type === 'cpu') {
      this.updateCardInfo();
      return;
    }

    // その他カード：結果を表示してダイスフェーズへ戻る
    const overlayScene = this.overlayScene;
    overlayScene.events.emit('show_event', {
      title: `${card?.name ?? 'カード'} 使用`,
      description: result.message ?? `${card?.name ?? 'カード'} を使いました`,
      onClose: () => this.updateCardInfo(),
    });
  }

  /**
   * コマを指定都市へ瞬間移動アニメーション
   */
  private teleportPawn(
    playerIndex: number,
    cityId: string,
    onComplete: () => void,
  ): void {
    const newPos = this.boardManager.getCityCanvasPos(cityId, MAP_AREA);
    if (!newPos) { onComplete(); return; }

    const offset = this.getPawnOffset(playerIndex);
    const container = this.pawnContainers[playerIndex];
    if (!container) { onComplete(); return; }

    this.tweens.add({
      targets: container,
      x: newPos.x + offset.x,
      y: newPos.y + offset.y,
      duration: 400,
      ease: 'Power3',
      onComplete: () => {
        const updatedPlayers = this.gameState.players.map((p, idx) =>
          idx === playerIndex
            ? { ...p, position: { ...p.position, cityId } as Position }
            : p,
        );
        this.gameState = { ...this.gameState, players: updatedPlayers };
        onComplete();
      },
    });
  }

  // ──────────────────────────────────────
  // ゲームロジック
  // ──────────────────────────────────────

  private onDiceButtonClick(): void {
    const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
    if (currentPlayer.type === 'cpu') return;
    if (this.gameState.phase !== 'dice_roll') return;

    this.rollAndMove();
  }

  private rollAndMove(): void {
    this.cardDrawnThisMove = false;
    const bonus = this.extraDiceBonus;
    this.extraDiceBonus = 0;
    const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
    const diceMultiplier = currentPlayer.diceMultiplier ?? 1;
    // diceMultiplier をリセット
    if (diceMultiplier !== 1) {
      this.gameState = {
        ...this.gameState,
        players: this.gameState.players.map((p, i) =>
          i === this.gameState.currentPlayerIndex ? { ...p, diceMultiplier: 1 } : p,
        ),
      };
    }
    const result = Math.floor((rollDice() + bonus) * diceMultiplier);
    this.diceButtonLabel.setText(`🎲 ${result}`);
    this.setDiceButtonEnabled(false);
    this.gameState = { ...this.gameState, phase: 'moving' };

    const animDuration = ANIMATION.DICE_ROLL_DURATION;
    const startTime = Date.now();
    const rollAnim = this.time.addEvent({
      delay: 80,
      repeat: 8,
      callback: () => {
        const tmp = rollDice();
        this.diceButtonLabel.setText(`🎲 ${tmp}`);
        if (Date.now() - startTime >= animDuration) rollAnim.remove();
      },
    });

    this.time.delayedCall(animDuration, () => {
      this.diceButtonLabel.setText(`🎲 ${result}`);
      this.movePawnStepByStep(this.gameState.currentPlayerIndex, result, () => {
        const player = this.gameState.players[this.gameState.currentPlayerIndex];
        this.onPlayerArrived(this.gameState.currentPlayerIndex, player.position.cityId);
      });
    });
  }

  /**
   * ステップ移動：1歩ずつ移動し、分岐でプレイヤーに選択を促す
   */
  private movePawnStepByStep(
    playerIndex: number,
    remainingSteps: number,
    onComplete: () => void,
  ): void {
    if (remainingSteps === 0) {
      onComplete();
      return;
    }

    const player = this.gameState.players[playerIndex];
    const routes = this.boardManager.getRoutesFromCity(player.position.cityId);
    const choices: RouteChoice[] = routes
      .map((route) => {
        const nextCityId = this.boardManager.getOtherCityId(route, player.position.cityId);
        const nextCity = this.boardManager.getCityById(nextCityId);
        return nextCity ? { route, nextCity } : null;
      })
      .filter((c): c is RouteChoice => c !== null);

    if (choices.length === 0) {
      onComplete();
      return;
    }

    const proceed = (chosen: RouteChoice): void => {
      this.moveOneStep(playerIndex, chosen.nextCity, chosen.route, () => {
        this.movePawnStepByStep(playerIndex, remainingSteps - 1, onComplete);
      });
    };

    if (choices.length > 1 && player.type === 'human') {
      this.showJunctionChoice(choices, proceed);
    } else {
      const chosen =
        player.type === 'cpu' && choices.length > 1
          ? this.cpuManager.chooseRoute(this.gameState, player, choices)
          : choices[0];
      proceed(chosen);
    }
  }

  /**
   * 1マス分の移動アニメーション＋カードマス判定
   */
  private moveOneStep(
    playerIndex: number,
    nextCity: City,
    route: Route,
    onComplete: () => void,
  ): void {
    const newPos = this.boardManager.getCityCanvasPos(nextCity.id, MAP_AREA);
    if (!newPos) { onComplete(); return; }

    const offset = this.getPawnOffset(playerIndex);
    const container = this.pawnContainers[playerIndex];
    if (!container) { onComplete(); return; }

    this.tweens.add({
      targets: container,
      x: newPos.x + offset.x,
      y: newPos.y + offset.y,
      duration: ANIMATION.MOVE_PER_SQUARE,
      ease: 'Power2',
      onComplete: () => {
        // 位置更新（previousCityId を記録）
        const prevCityId = this.gameState.players[playerIndex].position.cityId;
        const updatedPlayers = this.gameState.players.map((p, idx) =>
          idx === playerIndex
            ? {
                ...p,
                position: {
                  cityId: nextCity.id,
                  routeId: null,
                  squareIndex: 0,
                  previousCityId: prevCityId,
                } as Position,
              }
            : p,
        );
        this.gameState = { ...this.gameState, players: updatedPlayers };

        // カードマス：路線にカードマスがあり、かつ今ターン未取得なら1枚引く
        if (!this.cardDrawnThisMove && route.squares.includes('card')) {
          const player = this.gameState.players[playerIndex];
          if (this.cardManager.canDrawCard(this.gameState, player.id)) {
            const drawResult = this.cardManager.gainCard(this.gameState, player.id);
            if (drawResult.card) {
              this.gameState = drawResult.newState;
              this.cardDrawnThisMove = true;
              this.updateCardInfo();
              this.showCardDrawToast(drawResult.card.name);
            }
          } else if (player.type === 'human') {
            // 手札が一杯でカードを引けない場合は人間プレイヤーに通知
            this.showHandFullToast();
          }
        }

        onComplete();
      },
    });
  }

  /**
   * 後退移動：previousCityId を優先し、なければランダムな隣接都市へ
   */
  private movePawnBackward(
    playerIndex: number,
    remainingSteps: number,
    onComplete: () => void,
  ): void {
    if (remainingSteps === 0) {
      onComplete();
      return;
    }

    const player = this.gameState.players[playerIndex];
    const routes = this.boardManager.getRoutesFromCity(player.position.cityId);
    const choices: RouteChoice[] = routes
      .map((route) => {
        const nextCityId = this.boardManager.getOtherCityId(route, player.position.cityId);
        const nextCity = this.boardManager.getCityById(nextCityId);
        return nextCity ? { route, nextCity } : null;
      })
      .filter((c): c is RouteChoice => c !== null);

    if (choices.length === 0) {
      onComplete();
      return;
    }

    // previousCityId の方向を優先（なければランダム）
    const prevId = player.position.previousCityId;
    const backChoice =
      choices.find((c) => c.nextCity.id === prevId) ?? choices[0];

    this.moveOneStep(playerIndex, backChoice.nextCity, backChoice.route, () => {
      this.movePawnBackward(playerIndex, remainingSteps - 1, onComplete);
    });
  }

  /**
   * 分岐選択ダイアログ
   */
  private showJunctionChoice(
    choices: RouteChoice[],
    callback: (choice: RouteChoice) => void,
  ): void {
    this.destroyJunctionUI();

    const cx = 450;
    const dialogH = 50 + choices.length * 50;
    const dialogTopY = 360 - dialogH / 2;
    const objects: Phaser.GameObjects.GameObject[] = [];

    objects.push(
      this.add
        .rectangle(cx, dialogTopY + dialogH / 2, 300, dialogH, 0x222222, 0.92)
        .setOrigin(0.5),
    );
    objects.push(
      this.add
        .text(cx, dialogTopY + 16, 'どの路線を選びますか？', {
          fontFamily: FONTS.PRIMARY,
          fontSize: FONTS.SIZE.SM,
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    );

    choices.forEach((choice, i) => {
      const btnY = dialogTopY + 42 + i * 50;
      const routeName = ROUTE_TYPE_NAMES[choice.route.routeType] ?? choice.route.routeType;
      const btn = this.add
        .rectangle(cx, btnY, 260, 36, COLORS.PRIMARY)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const btnLabel = this.add
        .text(cx, btnY, `${choice.nextCity.name}（${routeName}）`, {
          fontFamily: FONTS.PRIMARY,
          fontSize: FONTS.SIZE.SM,
          color: '#ffffff',
        })
        .setOrigin(0.5);

      btn.on('pointerover', () => btn.setFillStyle(0xe65a2a));
      btn.on('pointerout', () => btn.setFillStyle(COLORS.PRIMARY));
      btn.on('pointerdown', () => {
        this.destroyJunctionUI();
        callback(choice);
      });

      objects.push(btn, btnLabel);
    });

    this.junctionUI = this.add.container(0, 0, objects);
    this.junctionUI.setDepth(50);
  }

  private destroyJunctionUI(): void {
    if (this.junctionUI) {
      this.junctionUI.destroy(true);
      this.junctionUI = null;
    }
  }

  /**
   * 目的地到着・カード売り場・物件チェック
   */
  private onPlayerArrived(playerIndex: number, cityId: string): void {
    const player = this.gameState.players[playerIndex];

    if (cityId === this.gameState.destinationCityId) {
      const arrival = this.destinationManager.processArrival(this.gameState, player.id);
      this.gameState = arrival.newState;

      const dest = this.boardManager.getCityById(cityId);
      const overlayScene = this.overlayScene;
      overlayScene.events.emit('show_destination_bonus', {
        player: this.gameState.players[playerIndex],
        bonus: arrival.bonus,
        destinationName: dest?.name ?? cityId,
        onClose: () => {
          this.updateTopBar();
          this.updatePlayerPanel();
          this.handleTileEffect(playerIndex, cityId);
        },
      });
      return;
    }

    this.handleTileEffect(playerIndex, cityId);
  }

  /**
   * マス効果処理：駅タイプに応じた処理を行い、必要なら物件チェックへ進む。
   * card_shop → カード売り場
   * plus → プラス駅（加算）
   * minus → マイナス駅（減算）
   * normal（省略時）→ 物件チェック
   */
  private handleTileEffect(playerIndex: number, cityId: string): void {
    const player = this.gameState.players[playerIndex];
    const city = this.boardManager.getCityById(cityId);
    const stationType = city?.stationType ?? 'normal';

    switch (stationType) {
      case 'card_shop': {
        if (player.type === 'human') {
          this.openCardShop(playerIndex, cityId);
        } else {
          this.cpuVisitShop(playerIndex, cityId);
        }
        break;
      }
      case 'plus': {
        const gain = this.calcPlusMinus('plus');
        this.gameState = {
          ...this.gameState,
          players: this.gameState.players.map((p, i) =>
            i === playerIndex ? { ...p, money: p.money + gain, totalAssets: p.totalAssets + gain } : p,
          ),
        };
        this.updatePlayerPanel();
        const overlayScenePlus = this.overlayScene;
        overlayScenePlus.events.emit('show_event', {
          title: 'プラス駅',
          description: `${player.name} が\n${formatManEn(gain)} もらいました！`,
          onClose: () => this.endTurn(),
        });
        break;
      }
      case 'minus': {
        const loss = this.calcPlusMinus('minus');
        this.gameState = {
          ...this.gameState,
          players: this.gameState.players.map((p, i) =>
            i === playerIndex ? { ...p, money: p.money - loss, totalAssets: p.totalAssets - loss } : p,
          ),
        };
        this.updatePlayerPanel();
        const overlaySceneMinus = this.overlayScene;
        overlaySceneMinus.events.emit('show_event', {
          title: 'マイナス駅',
          description: `${player.name} が\n${formatManEn(loss)} 失いました...`,
          onClose: () => this.endTurn(),
        });
        break;
      }
      default: {
        // normal: 物件チェック
        this.checkPropertyAndEndTurn(playerIndex, cityId);
        break;
      }
    }
  }

  /**
   * プラス/マイナス駅の金額計算（年数インフレあり）
   */
  private calcPlusMinus(dir: 'plus' | 'minus'): number {
    const base = 500 * (1 + (this.gameState.currentYear - 1) * 0.2);
    return Math.round(base * (dir === 'minus' ? 0.8 : 1));
  }

  /**
   * CPU のカード売り場訪問（所持金に余裕があれば購入）
   */
  private cpuVisitShop(playerIndex: number, cityId: string): void {
    const lineup = this.cardManager.getShopLineup(5);
    let purchased = 0;
    const purchasedNames: string[] = [];

    for (const card of lineup) {
      if (purchased >= 2) break;
      const currentPlayer = this.gameState.players[playerIndex];
      if (!this.cardManager.canDrawCard(this.gameState, currentPlayer.id)) break;

      const price = this.cardManager.getCardShopPrice(card);
      // 所持金の1/3以上残るなら購入する
      if (currentPlayer.money >= price * 3) {
        const result = this.cardManager.buyCard(this.gameState, currentPlayer.id, card.id);
        if (result.success) {
          this.gameState = result.newState;
          purchased++;
          purchasedNames.push(card.name);
        }
      }
    }

    if (purchased > 0) {
      this.updatePlayerPanel();
      const player = this.gameState.players[playerIndex];
      const label = purchasedNames.length === 1
        ? `${player.name} が「${purchasedNames[0]}」を購入！`
        : `${player.name} がカードを${purchased}枚購入！`;
      this.showActionToast(label);
    }
    this.checkPropertyAndEndTurn(playerIndex, cityId);
  }

  /**
   * カード売り場を開く（購入後に再オープン可能）
   */
  private openCardShop(playerIndex: number, cityId: string): void {
    // 購入後の再表示で常に最新の player を参照するため、毎回 gameState から取得
    const player = this.gameState.players[playerIndex];
    const lineup = this.cardManager.getShopLineup(5);
    const overlayScene = this.overlayScene;

    overlayScene.events.emit('show_card_shop', {
      player,
      lineup,
      getPrice: (card: Card) => this.cardManager.getCardShopPrice(card),
      onBuy: (cardId: string) => {
        const result = this.cardManager.buyCard(this.gameState, player.id, cardId);
        if (result.success) {
          this.gameState = result.newState;
          this.updatePlayerPanel();
        }
        // 購入後に売り場を再表示（手札満杯なら物件チェックへ進む）
        const canBuyMore = this.cardManager.canDrawCard(
          this.gameState, this.gameState.players[playerIndex].id,
        );
        if (canBuyMore) {
          // 再表示時は最新の gameState から player を取得するため再帰呼び出し
          this.openCardShop(playerIndex, cityId);
        } else {
          this.checkPropertyAndEndTurn(playerIndex, cityId);
        }
      },
      onClose: () => this.checkPropertyAndEndTurn(playerIndex, cityId),
    });
  }

  /**
   * 物件チェック → ターン終了
   */
  private checkPropertyAndEndTurn(playerIndex: number, cityId: string): void {
    const player = this.gameState.players[playerIndex];
    const cityProperties = this.propertyManager.getPropertiesByCity(
      this.gameState.properties,
      cityId,
    );

    if (cityProperties.length === 0) {
      this.endTurn();
      return;
    }

    const unowned = cityProperties.find((p) => p.ownerId === null);
    if (unowned && player.money >= this.propertyManager.getCurrentPrice(unowned)) {
      if (player.type === 'cpu') {
        const decision = this.cpuManager.decidePurchase(this.gameState, player, unowned);
        if (decision.type === 'buy_property') {
          const result = this.propertyManager.buyProperty(
            this.gameState, player.id, unowned.id,
          );
          if (result.success && result.newState) {
            this.gameState = result.newState;
            this.updatePlayerPanel();
            // 独占達成チェック
            if (this.propertyManager.hasMonopoly(this.gameState.properties, cityId, player.id)) {
              const cityName = this.boardManager.getCityById(cityId)?.name ?? cityId;
              this.showActionToast(`${player.name} が ${cityName} を独占！`);
            }
          }
        }
        this.endTurn();
        return;
      }

      const overlayScene = this.overlayScene;
      overlayScene.events.emit('show_property_purchase', {
        property: unowned,
        player,
        onBuy: () => {
          const result = this.propertyManager.buyProperty(
            this.gameState, player.id, unowned.id,
          );
          if (result.success && result.newState) {
            this.gameState = result.newState;
            this.updatePlayerPanel();
            // 独占達成チェック
            if (this.propertyManager.hasMonopoly(this.gameState.properties, cityId, player.id)) {
              const cityName = this.boardManager.getCityById(cityId)?.name ?? cityId;
              this.showMonopolyToast(cityName);
            }
          }
          this.endTurn();
        },
        onSkip: () => this.endTurn(),
      });
      return;
    }

    // 自分の物件アップグレード
    const ownUpgradable = cityProperties.find(
      (p) =>
        p.ownerId === player.id &&
        p.upgradeLevel < p.upgradePrices.length &&
        player.money >= p.upgradePrices[p.upgradeLevel],
    );
    if (ownUpgradable) {
      if (player.type === 'cpu') {
        // CPUは常にアップグレード（簡易判定）
        const result = this.propertyManager.upgradeProperty(
          this.gameState, player.id, ownUpgradable.id,
        );
        if (result.success && result.newState) {
          this.gameState = result.newState;
          this.updatePlayerPanel();
          const nextLv = ownUpgradable.upgradeLevel + 1;
          this.showActionToast(`${player.name} が「${ownUpgradable.name}」をLv${nextLv}にアップグレード！`);
        }
        this.endTurn();
        return;
      }

      const overlayScene = this.overlayScene;
      overlayScene.events.emit('show_property_upgrade', {
        property: ownUpgradable,
        player,
        onUpgrade: () => {
          const result = this.propertyManager.upgradeProperty(
            this.gameState, player.id, ownUpgradable.id,
          );
          if (result.success && result.newState) {
            this.gameState = result.newState;
            this.updatePlayerPanel();
          }
          this.endTurn();
        },
        onSkip: () => this.endTurn(),
      });
      return;
    }

    this.endTurn();
  }

  /**
   * 破産処理：所持金が地代を下回る場合、物件を半額で売却して資金を確保する
   * - 人間: 物件選択ダイアログを表示（「このまま続ける」で負債を受け入れる）
   * - CPU: 最安値物件を自動売却（不足が解消するまで繰り返す）
   */
  private handleBankruptcy(playerId: string, requiredAmount: number, onResolved: () => void): void {
    const player = this.gameState.players.find((p) => p.id === playerId)!;
    const ownedProperties = this.propertyManager.getOwnedProperties(
      this.gameState.properties, playerId,
    );

    if (player.type === 'cpu') {
      // CPU: 最安値物件を自動売却（再帰ではなくループで実装しスタック蓄積を防ぐ）
      let currentPlayer = player;
      while (currentPlayer.money < requiredAmount) {
        const currentOwned = this.propertyManager.getOwnedProperties(
          this.gameState.properties, playerId,
        );
        if (currentOwned.length === 0) break;
        const cheapest = currentOwned.reduce((min, p) => (p.price < min.price ? p : min));
        this.gameState = this.propertyManager.sellPropertyForcibly(
          this.gameState, playerId, cheapest.id,
        );
        currentPlayer = this.gameState.players.find((p) => p.id === playerId) ?? currentPlayer;
      }
      this.updatePlayerPanel();
      onResolved();
      return;
    }

    // 人間: ダイアログ表示
    const overlayScene = this.overlayScene;
    const bankruptcyData: BankruptcyData = {
      player,
      debtAmount: requiredAmount,
      properties: ownedProperties,
      onSell: (propertyId: string) => {
        this.gameState = this.propertyManager.sellPropertyForcibly(
          this.gameState, playerId, propertyId,
        );
        this.updatePlayerPanel();
        const updatedPlayer = this.gameState.players.find((p) => p.id === playerId)!;
        if (updatedPlayer.money >= requiredAmount) {
          onResolved();
        } else {
          // まだ不足 → 再表示
          this.handleBankruptcy(playerId, requiredAmount, onResolved);
        }
      },
      onConfirm: () => onResolved(), // 負債を受け入れてそのまま続ける
    };
    overlayScene.events.emit('show_bankruptcy', bankruptcyData);
  }

  /**
   * ターン終了：ボンビー行動 → 月を進める
   */
  private endTurn(): void {
    const bombeeResult = this.bombeeManager.processBombeeAction(this.gameState);
    this.gameState = bombeeResult.newState;

    if (bombeeResult.message) {
      this.updatePlayerPanel();
      const overlayScene = this.overlayScene;
      overlayScene.events.emit('show_event', {
        title: 'ボンビー行動！',
        description: bombeeResult.message,
        onClose: () => this.advanceMonth(),
      });
      return;
    }

    this.advanceMonth();
  }

  /**
   * 月を進める：月替わりイベント → 年末決算 or 次プレイヤー
   */
  private advanceMonth(): void {
    const nextMonth = this.gameState.currentMonth + 1;

    if (nextMonth > 12) {
      this.gameState = {
        ...this.gameState,
        currentMonth: 1,
        currentYear: this.gameState.currentYear + 1,
      };
      this.triggerYearEnd();
      return;
    }

    this.gameState = { ...this.gameState, currentMonth: nextMonth };

    const events = this.eventManager.drawMonthlyEvents(nextMonth);
    if (events.length > 0) {
      this.applyEventsSequentially(events, 0, () => this.nextPlayer());
      return;
    }

    this.nextPlayer();
  }

  /**
   * イベントを順番に表示・適用する
   */
  private applyEventsSequentially(
    events: GameEvent[],
    index: number,
    onDone: () => void,
  ): void {
    if (index >= events.length) {
      onDone();
      return;
    }

    const event = events[index];
    const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
    const result = this.eventManager.applyEvent(this.gameState, event, currentPlayer.id);
    this.gameState = result.newState;
    this.updatePlayerPanel();

    const overlayScene = this.overlayScene;
    overlayScene.events.emit('show_event', {
      title: event.name,
      description: event.description,
      onClose: () => this.applyEventsSequentially(events, index + 1, onDone),
    });
  }

  /**
   * 年末決算
   */
  private triggerYearEnd(): void {
    if (this.gameState.currentYear > this.gameState.totalYears) {
      this.scene.start(SCENE_KEYS.RESULT, { gameState: this.gameState });
      return;
    }

    const { newState, results } = this.propertyManager.calcYearEndIncome(this.gameState);
    this.gameState = this.bombeeManager.decrementBombeeImmunity(newState);

    const overlayScene = this.overlayScene;
    overlayScene.events.emit('show_year_end', {
      year: this.gameState.currentYear - 1,
      results,
      players: this.gameState.players,
      onClose: () => {
        this.updatePlayerPanel();
        this.nextPlayer();
      },
    });
  }

  /**
   * 次のプレイヤーに交代
   */
  private nextPlayer(): void {
    // 残留オーバーレイを確実にクリアし game.input.enabled を復元する。
    // CPUカード使用ダイアログなどが閉じられないまま残ることがあるため。
    this.overlayScene.hideOverlay();

    const nextIndex =
      (this.gameState.currentPlayerIndex + 1) % this.gameState.players.length;
    this.gameState = {
      ...this.gameState,
      currentPlayerIndex: nextIndex,
      phase: 'dice_roll',
      turnCount: this.gameState.turnCount + 1,
    };

    this.updateTopBar();
    this.updatePhaseText();
    this.updatePlayerPanel();
    this.setDiceButtonEnabled(false); // バナー表示中は無効化

    const nextPlayer = this.gameState.players[nextIndex];
    this.showTurnBanner(nextPlayer.name, () => {
      if (nextPlayer.type === 'cpu') {
        const delay = this.cpuManager.getThinkingDelay(nextPlayer.difficulty);
        this.time.delayedCall(delay, () => this.cpuTakeTurn(nextIndex));
      } else {
        this.setDiceButtonEnabled(true);
      }
    });
  }

  /**
   * ゲーム開始時の最初のターン処理
   * 新規ゲームはスタートバナーを挟んでからプレイヤーターンバナーへ
   * ロード時はプレイヤーターンバナーのみ
   */
  private startFirstTurn(): void {
    const player = this.gameState.players[this.gameState.currentPlayerIndex];
    const showPlayerTurn = (): void => {
      this.showTurnBanner(player.name, () => {
        if (player.type === 'cpu') {
          const delay = this.cpuManager.getThinkingDelay(player.difficulty);
          this.time.delayedCall(delay, () => this.cpuTakeTurn(this.gameState.currentPlayerIndex));
        } else {
          this.setDiceButtonEnabled(true);
        }
      });
    };
    if (this.isNewGame) {
      this.showStartBanner(showPlayerTurn);
    } else {
      showPlayerTurn();
    }
  }

  /**
   * ゲームスタートバナー（赤背景、約2秒）を表示し onComplete() を呼ぶ
   */
  private showStartBanner(onComplete: () => void): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const years = this.gameState.totalYears;

    const bg = this.add
      .rectangle(cx, cy, width, 140, 0x8b0000, 0.92)
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(0);
    const title = this.add
      .text(cx, cy - 28, 'ゲームスタート！', {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.XL,
        color: '#ffe066',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setAlpha(0);
    const subtitle = this.add
      .text(cx, cy + 22, `目標：${years}年後に総資産トップを目指せ！`, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setAlpha(0);

    const targets = [bg, title, subtitle];
    this.tweens.add({
      targets,
      alpha: { from: 0, to: 1 },
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(1400, () => {
          this.tweens.add({
            targets,
            alpha: 0,
            duration: 350,
            ease: 'Power2',
            onComplete: () => {
              bg.destroy();
              title.destroy();
              subtitle.destroy();
              onComplete();
            },
          });
        });
      },
    });
  }

  /**
   * ターン開始バナーを画面中央に表示する（約1.5秒）
   * フェードイン → 保持 → フェードアウト後に onComplete() を呼ぶ
   */
  private showTurnBanner(playerName: string, onComplete: () => void): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    const bg = this.add
      .rectangle(cx, cy, width, 100, 0x1a2a4a, 0.88)
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(0);
    const text = this.add
      .text(cx, cy, `${playerName} のターン`, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.XL,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setAlpha(0);

    this.tweens.add({
      targets: [bg, text],
      alpha: { from: 0, to: 1 },
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(900, () => {
          this.tweens.add({
            targets: [bg, text],
            alpha: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
              bg.destroy();
              text.destroy();
              onComplete();
            },
          });
        });
      },
    });
  }

  /**
   * CPUターン：カード使用判断 → サイコロ
   */
  private cpuTakeTurn(playerIndex: number): void {
    const player = this.gameState.players[playerIndex];
    const decision = this.cpuManager.decideCardUse(this.gameState, player);

    if (decision.type === 'use_card' && decision.cardId) {
      const cardId = decision.cardId;
      const card = this.cardManager.getCardById(cardId);
      if (card) {
        // CPU がカードを使う旨を通知
        this.showActionToast(`${player.name} が「${card.name}」を使用！`);

        // 対象プレイヤーが必要なカード：最も資産の多い対戦相手を選択
        const needsTarget = card.type === 'bombee_transfer' || card.type === 'card_steal';
        const isLastToSecond =
          card.type === 'bombee_transfer' && card.effect.targetType === 'last_to_second';

        const applyDelay = 600; // トースト表示後に効果適用
        this.time.delayedCall(applyDelay, () => {
          if (needsTarget && !isLastToSecond) {
            const targetPlayer = this.gameState.players
              .filter((p) => p.id !== player.id)
              .reduce((best, p) => p.totalAssets > best.totalAssets ? p : best);
            this.applyCardEffect(cardId, {
              targetPlayerId: targetPlayer.id,
              targetCityId: player.position.cityId,
            });
          } else {
            this.applyCardEffect(cardId, { targetCityId: player.position.cityId });
          }

          // カード使用後、移動系以外はサイコロへ
          const isMovementCard = card.type === 'move_to_destination'
            || card.type === 'move_to_city'
            || card.type === 'move_steps';

          if (!isMovementCard) {
            const delay = this.cpuManager.getThinkingDelay(player.difficulty);
            this.time.delayedCall(delay, () => this.rollAndMove());
          }
        });
        return;
      }
    }

    this.rollAndMove();
  }

  // ──────────────────────────────────────
  // UI更新
  // ──────────────────────────────────────

  private updateTopBar(): void {
    const { currentYear, currentMonth, currentPlayerIndex } = this.gameState;
    const player = this.gameState.players[currentPlayerIndex];
    const dest = this.boardManager.getCityById(this.gameState.destinationCityId);
    const currentCity = this.boardManager.getCityById(player.position.cityId);
    const playerColorIdx = currentPlayerIndex % PAWN_COLORS.length;

    // プレイヤー色丸
    this.topBarPlayerDot.setFillStyle(PAWN_COLORS[playerColorIdx]);

    // プレイヤー名（CPU表示付き）
    const cpuLabel = player.type === 'cpu' ? ' (CPU)' : '';
    this.topBarPlayerName.setText(`${player.name}${cpuLabel}`);

    // 現在地
    this.topBarCurrentCity.setText(currentCity?.name ?? '---');

    // 目的地
    this.topBarDestInfo.setText(`→ ${dest?.name ?? '???'}`);

    // 所持金（赤=マイナス）
    const moneyColor = player.money < 0 ? '#ff4444' : '#ffffff';
    this.topBarMoney.setText(formatManEn(player.money)).setColor(moneyColor);

    // 年目
    this.topBarYear.setText(`${currentYear}年目`);

    // 月（大きい数字）
    this.topBarMonth.setText(`${currentMonth}`);

    this.updateMapMarkers();
  }

  /**
   * マップ上の目的地マーカーとボンビーマーカーを更新
   */
  private updateMapMarkers(): void {
    // 目的地マーカー（黄色の星）
    const destPos = this.boardManager.getCityCanvasPos(
      this.gameState.destinationCityId,
      MAP_AREA,
    );
    if (this.destinationMarker) this.destinationMarker.destroy();
    this.destinationMarker = null;
    if (destPos) {
      const container = this.add.container(destPos.x, destPos.y - 18);
      const circle = this.add.circle(0, 0, 10, 0xf1c40f, 0.9);
      const label = this.add.text(0, 0, '★', {
        fontFamily: FONTS.PRIMARY,
        fontSize: 10,
        color: '#ffffff',
      }).setOrigin(0.5);
      container.add([circle, label]);
      this.destinationMarker = container;
    }

    // ボンビーマーカー（赤丸）
    if (this.bombeeMarker) this.bombeeMarker.destroy();
    this.bombeeMarker = null;
    const bombeePlayer = this.gameState.players.find((p) => p.bombeeType !== 'none');
    if (bombeePlayer) {
      const bombeePos = this.boardManager.getCityCanvasPos(
        bombeePlayer.position.cityId,
        MAP_AREA,
      );
      if (bombeePos) {
        const container = this.add.container(bombeePos.x + 14, bombeePos.y - 14);
        const circle = this.add.circle(0, 0, 8, 0xe74c3c, 0.85);
        const bombeeIcon: Record<string, string> = { mini: '😈', normal: '👿', king: '🔴' };
        const label = this.add.text(0, 0, bombeeIcon[bombeePlayer.bombeeType] ?? '😈', {
          fontFamily: FONTS.PRIMARY,
          fontSize: 8,
        }).setOrigin(0.5);
        container.add([circle, label]);
        this.bombeeMarker = container;
      }
    }

    // 物件所有ドット（都市ごとにオーナーの色ドット）
    this.propertyDotContainers.forEach((c) => c.destroy());
    this.propertyDotContainers = [];

    // 都市ごとに所有物件をグルーピング
    const cityOwners = new Map<string, Set<string>>();
    for (const prop of this.gameState.properties) {
      if (!prop.ownerId) continue;
      if (!cityOwners.has(prop.cityId)) cityOwners.set(prop.cityId, new Set());
      cityOwners.get(prop.cityId)!.add(prop.ownerId);
    }

    cityOwners.forEach((ownerIds, cityId) => {
      const cityPos = this.boardManager.getCityCanvasPos(cityId, MAP_AREA);
      if (!cityPos) return;
      const owners = [...ownerIds];
      owners.forEach((ownerId, idx) => {
        const player = this.gameState.players.find((p) => p.id === ownerId);
        if (!player) return;
        const dotX = cityPos.x + (idx - (owners.length - 1) / 2) * 7;
        const dotY = cityPos.y + 12;
        const container = this.add.container(dotX, dotY);
        const dot = this.add.circle(0, 0, 4, player.color, 0.9);
        container.add(dot);
        this.propertyDotContainers.push(container);
      });
    });
  }

  private updatePhaseText(): void {
    const player = this.gameState.players[this.gameState.currentPlayerIndex];
    this.diceButtonLabel.setText(
      player.type === 'cpu' ? '考え中...' : '🎲 サイコロ',
    );
  }

  private updatePlayerPanel(): void {
    this.updateTopBar();
  }

  /** updateCardInfo は updatePlayerPanel に統合済み。後方互換のため残す */
  private updateCardInfo(): void {
    this.updatePlayerPanel();
  }

  /**
   * カードドロー時のフラッシュ通知（移動を止めない）
   */
  private showCardDrawToast(cardName: string): void {
    const { width } = this.scale;
    const toast = this.add
      .text(width / 2, 340, `🃏 カード入手！\n「${cardName}」`, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#8e44ad',
        padding: { x: 14, y: 8 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(0);

    this.tweens.add({
      targets: toast,
      alpha: { from: 0, to: 1 },
      y: { from: 360, to: 320 },
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(900, () => {
          this.tweens.add({
            targets: toast,
            alpha: 0,
            y: 300,
            duration: 300,
            ease: 'Power2',
            onComplete: () => toast.destroy(),
          });
        });
      },
    });
  }

  /**
   * 独占達成時の祝福トースト（人間プレイヤー向け）
   */
  private showMonopolyToast(cityName: string): void {
    const { width } = this.scale;
    const toast = this.add
      .text(width / 2, 340, `★ ${cityName} を独占！\n収益が2倍になります！`, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#ffe066',
        fontStyle: 'bold',
        backgroundColor: '#8b0000',
        padding: { x: 16, y: 10 },
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(110)
      .setAlpha(0);

    this.tweens.add({
      targets: toast,
      alpha: { from: 0, to: 1 },
      y: { from: 360, to: 310 },
      duration: 250,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(1200, () => {
          this.tweens.add({
            targets: toast,
            alpha: 0,
            y: 280,
            duration: 350,
            ease: 'Power2',
            onComplete: () => toast.destroy(),
          });
        });
      },
    });
  }

  /**
   * 手札が一杯でカードを引けなかった場合の通知トースト
   */
  private showHandFullToast(): void {
    const { width } = this.scale;
    const maxCards = GAME_CONFIG.MAX_CARD_COUNT;
    const toast = this.add
      .text(width / 2, 340, `手札が一杯！（${maxCards}/${maxCards}枚）\nカードマスを通過しました`, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#ffffff',
        fontStyle: 'bold',
        backgroundColor: '#7f8c8d',
        padding: { x: 14, y: 8 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(0);

    this.tweens.add({
      targets: toast,
      alpha: { from: 0, to: 1 },
      y: { from: 360, to: 320 },
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(900, () => {
          this.tweens.add({
            targets: toast,
            alpha: 0,
            y: 300,
            duration: 300,
            ease: 'Power2',
            onComplete: () => toast.destroy(),
          });
        });
      },
    });
  }

  /**
   * 汎用アクション通知トースト（CPUアクション等の通知に使用）
   */
  private showActionToast(message: string): void {
    const { width } = this.scale;
    const toast = this.add
      .text(width / 2, 300, message, {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.SM,
        color: '#ffffff',
        backgroundColor: '#2c3e50',
        padding: { x: 14, y: 8 },
        align: 'center',
        wordWrap: { width: 320 },
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setAlpha(0);

    this.tweens.add({
      targets: toast,
      alpha: { from: 0, to: 1 },
      y: { from: 320, to: 280 },
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(1200, () => {
          this.tweens.add({
            targets: toast,
            alpha: 0,
            y: 260,
            duration: 300,
            ease: 'Power2',
            onComplete: () => toast.destroy(),
          });
        });
      },
    });
  }

  private setDiceButtonEnabled(enabled: boolean): void {
    this.diceButton.setInteractive(enabled);
    this.diceButton.setFillStyle(enabled ? COLORS.PRIMARY : 0xaaaaaa);
    this.diceButton.setAlpha(enabled ? 1 : 0.6);
  }

  // ──────────────────────────────────────
  // 初期状態生成
  // ──────────────────────────────────────

  private createInitialState(config: GameConfig): GameState {
    const startCity = 'tokyo';
    const destination = this.boardManager.getRandomDestination(startCity);

    const players: Player[] = config.players.map((cfg, i) => ({
      id: `player_${i}`,
      name: cfg.name,
      type: cfg.type,
      difficulty: cfg.difficulty,
      money: 10000,
      totalAssets: 10000,
      position: { cityId: startCity, routeId: null, squareIndex: 0 } as Position,
      hand: [],
      bombeeType: 'none',
      bombeeElapsedTurns: 0,
      color: PAWN_COLORS[i],
      pawIndex: i,
      incomeMultiplier: 1,
      diceMultiplier: 1,
      bombeeImmuneYears: 0,
    }));

    return {
      id: `game_${Date.now()}`,
      currentYear: 1,
      currentMonth: 4,
      totalYears: config.totalYears,
      currentPlayerIndex: 0,
      phase: 'dice_roll',
      players,
      properties: this.cache.json.get('properties') ?? [],
      destinationCityId: destination?.id ?? 'osaka',
      turnCount: 0,
    };
  }
}
