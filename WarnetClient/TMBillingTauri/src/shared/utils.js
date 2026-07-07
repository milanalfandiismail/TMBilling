/**
 * Shared Utilities
 * Helper functions untuk Kiosk dan Overlay mode
 */

/**
 * Format detik menjadi string waktu yang readable
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatTime(totalSeconds) {
    if (totalSeconds >= 999999) return "Unlimited";
    if (totalSeconds <= 0) return "Sesi Berakhir";

    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    let result = "";
    if (hours > 0) {
        result += `${hours} jam `;
    }

    if (minutes > 0 || hours === 0) {
        result += `${minutes} menit`;
    }

    return result.trim();
}

/**
 * Format angka menjadi Rupiah
 * @param {number} value
 * @returns {string}
 */
export function formatRupiah(value) {
    return 'Rp ' + Number(value).toLocaleString('id-ID');
}

/**
 * Format durasi menit ke string readable
 * @param {number} durasiMenit
 * @returns {string}
 */
export function formatDuration(durasiMenit) {
    return durasiMenit >= 60
        ? (durasiMenit / 60) + ' Jam'
        : durasiMenit + ' Menit';
}
