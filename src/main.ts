import Phaser from 'phaser';
import { GAME_CONFIG } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { PlayerSetupScene } from './scenes/PlayerSetupScene';
import { GameScene } from './scenes/GameScene';
import { OverlayScene } from './scenes/OverlayScene';
import { ResultScene } from './scenes/ResultScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.WIDTH,
  height: GAME_CONFIG.HEIGHT,
  backgroundColor: '#fff9f0',
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    PlayerSetupScene,
    GameScene,
    OverlayScene,
    ResultScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  parent: 'game-container',
};

new Phaser.Game(config);
