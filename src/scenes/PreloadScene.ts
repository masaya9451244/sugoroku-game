import Phaser from 'phaser';
import { SCENE_KEYS, COLORS, FONTS } from '../config';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.PRELOAD });
  }

  preload(): void {
    this.showLoadingBar();

    // ゲームデータJSONの読み込み
    this.load.json('cities', 'assets/data/cities.json');
    this.load.json('routes', 'assets/data/routes.json');
    this.load.json('properties', 'assets/data/properties.json');
    this.load.json('cards', 'assets/data/cards.json');
    this.load.json('events', 'assets/data/events.json');
  }

  create(): void {
    this.scene.start(SCENE_KEYS.TITLE);
  }

  private showLoadingBar(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.add
      .text(cx, cy - 60, '読み込み中...', {
        fontFamily: FONTS.PRIMARY,
        fontSize: FONTS.SIZE.LG,
        color: `#${COLORS.TEXT_PRIMARY.toString(16).padStart(6, '0')}`,
      })
      .setOrigin(0.5);

    this.add.rectangle(cx, cy, 400, 20, 0xdddddd).setOrigin(0.5);
    const bar = this.add.rectangle(cx - 200, cy, 0, 20, COLORS.PRIMARY).setOrigin(0, 0.5);

    this.load.on('progress', (value: number) => {
      bar.width = 400 * value;
    });
  }
}
