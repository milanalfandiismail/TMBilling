/**
 * Shared Constants
 * Konstanta yang digunakan di Kiosk dan Overlay mode
 */

export const AUDIO_WARNING_PATH = 'assets/sounds/warning_5min.mp3';
export const AUDIO_WARNING_VOLUME = 0.7;

export const TIME_THRESHOLD_5MIN = 300; // 5 menit dalam detik
export const TIME_THRESHOLD_5MAX = 290; // range untuk trigger alert

export const ITEMS_PER_PAGE = 5;
export const ITEMS_PER_RULES_PAGE = 10;

export const STATUS = {
    KOSONG: 'kosong',
    AKTIF: 'aktif',
    ADMIN: 'admin',
    ERROR: 'error'
};
