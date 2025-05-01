const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Constructs the full URL for an audio file, removing any duplicate /api prefix
 * @param {string} audioPath - The path to the audio file (e.g. '/episodes/1/segments/1_raw.wav')
 * @returns {string} The full URL for the audio file
 */
export const getAudioUrl = (audioPath) => {
  // Remove any leading /api from the API_URL
  const baseUrl = API_URL.replace('/api', '');
  return `${baseUrl}${audioPath}`;
}; 