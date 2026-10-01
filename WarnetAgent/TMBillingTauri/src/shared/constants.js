/**
 * Shared Constants
 * Konstanta yang digunakan di Kiosk dan Overlay mode
 */

export const AUDIO_WARNING_15MIN_PATH = 'assets/sounds/warning_15min.mp3';
export const AUDIO_WARNING_5MIN_PATH = 'assets/sounds/warning_5min.mp3';
export const AUDIO_WARNING_1MIN_PATH = 'assets/sounds/warning_1min.mp3';
export const AUDIO_WARNING_PATH = AUDIO_WARNING_5MIN_PATH;

export const AUDIO_TARGET_SYSTEM_VOLUME = 1.0; // 100% master volume sistem Windows
export const AUDIO_PLAYBACK_VOLUME = 1.0; // 100% volume audio playback

export const TIME_THRESHOLD_15MIN = 900; // 15 menit dalam detik
export const TIME_THRESHOLD_5MIN = 300;  // 5 menit dalam detik
export const TIME_THRESHOLD_1MIN = 60;   // 1 menit dalam detik

export const ITEMS_PER_PAGE = 5;
export const ITEMS_PER_RULES_PAGE = 10;

export const STATUS = {
    KOSONG: 'kosong',
    AKTIF: 'aktif',
    ADMIN: 'admin',
    ERROR: 'error'
};
