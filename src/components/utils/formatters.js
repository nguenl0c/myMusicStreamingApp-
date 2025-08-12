// Shared formatting helpers for Mixer and other media-related views
// All functions are pure & defensive against invalid inputs.

/**
 * Format a file size in bytes into a human readable string.
 * @param {number} bytes
 * @param {Object} [opts]
 * @param {number} [opts.decimals=2] - Number of decimals for non-bytes units
 * @returns {string}
 */
export function formatFileSize(bytes, opts = {}) {
	const { decimals = 2 } = opts;
	if (bytes === 0) return '0 Bytes';
	if (!bytes || isNaN(bytes) || bytes < 0) return '—';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	if (i === 0) return `${bytes} ${sizes[i]}`; // No decimals for Bytes
	const value = bytes / Math.pow(k, i);
	const fixed = value.toFixed(value >= 100 || decimals < 0 ? 0 : decimals);
	return `${parseFloat(fixed)} ${sizes[i]}`;
}

/**
 * Format an ISO date string (or Date) to a Vietnamese locale date-time.
 * Falls back gracefully on invalid input.
 * @param {string|Date|number} dateInput
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export function formatDate(dateInput, options) {
	if (!dateInput) return '—';
	try {
		const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
		if (isNaN(date.getTime())) return '—';
		const defaultOpts = {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		};
		return date.toLocaleString('vi-VN', { ...defaultOpts, ...(options || {}) });
		} catch {
		return '—';
	}
}

/**
 * Format a time duration (seconds or milliseconds) to mm:ss (or hh:mm:ss if >= 1h)
 * Accepts numbers (seconds) or strings / numbers representing ms (>= 1000 & not integer seconds).
 * @param {number} secondsOrMs
 * @returns {string}
 */
export function formatTime(secondsOrMs) {
	if (secondsOrMs == null || secondsOrMs === '' || isNaN(secondsOrMs)) return '0:00';
	let totalSeconds = Number(secondsOrMs);
	// Heuristic: treat large values as milliseconds
	if (totalSeconds > 3600 * 10) { // >10 hours in seconds? likely ms provided
		totalSeconds = totalSeconds / 1000;
	}
	// If looks like milliseconds (>=1000 and not an integer second)
	if (totalSeconds >= 1000 && !Number.isInteger(totalSeconds) && totalSeconds % 1 !== 0) {
		// already fine
	}
	if (totalSeconds < 0) totalSeconds = 0;
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = Math.floor(totalSeconds % 60);
	const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
	const ss = String(seconds).padStart(2, '0');
	return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default { formatFileSize, formatDate, formatTime };
