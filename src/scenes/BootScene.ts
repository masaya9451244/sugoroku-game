import Phaser from 'phaser';
import { SCENE_KEYS } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.BOOT });
  }

  preload(): void {
    // 最小限のアセット（ローディング画面用）を読み込む
  }

  create(): void {
    this.scene.start(SCENE_KEYS.PRELOAD);
  }
}
