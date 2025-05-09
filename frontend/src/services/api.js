import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Set up axios instance with basic auth
const api = axios.create({
  baseURL: API_URL,
  auth: {
    username: localStorage.getItem('username') || 'admin',
    password: localStorage.getItem('password') || 'password',
  },
});

// Episode API
export const getEpisodes = () => api.get('/episodes');
export const getEpisode = (id) => api.get(`/episodes/${id}`);
export const createEpisode = (data) => api.post('/episodes', data);
export const updateEpisode = (id, data) => api.put(`/episodes/${id}`, data);
export const deleteEpisode = (id) => api.delete(`/episodes/${id}`);

// Source API
export const getSources = () => api.get('/sources');
export const getSource = (id) => api.get(`/sources/${id}`);
export const createSource = (data) => {
  return api.post('/sources', data);
};
export const updateSource = (id, data) => api.put(`/sources/${id}`, data);
export const deleteSource = (id) => api.delete(`/sources/${id}`);
export const addSourceToEpisode = (episodeId, sourceId) => 
  api.post(`/episodes/${episodeId}/sources/${sourceId}`);
export const removeSourceFromEpisode = (episodeId, sourceId) => 
  api.delete(`/episodes/${episodeId}/sources/${sourceId}`);

// Segment API
export const getSegments = (episodeId) => api.get(`/episodes/${episodeId}/segments`);
export const getSegment = (episodeId, segmentId) => api.get(`/episodes/${episodeId}/segments/${segmentId}`);
export const createSegment = (episodeId, data) => api.post(`/episodes/${episodeId}/segments`, data);
export const updateSegment = (episodeId, segmentId, data) => api.put(`/episodes/${episodeId}/segments/${segmentId}`, data);
export const deleteSegment = (episodeId, segmentId) => api.delete(`/episodes/${episodeId}/segments/${segmentId}`);

// Audio API
export const transcribeAudio = (filePath) => api.post('/audio/transcribe', { file_path: filePath });
export const generateSpeech = (text, episodeId, segmentId) => api.post('/audio/synthesize', { text, episode_id: episodeId, segment_id: segmentId });
export const uploadAudio = (episodeId, segmentId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/audio/upload?episode_id=${episodeId}&segment_id=${segmentId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// LLM API
export const generateText = (episodeId, prompt, order_index, history = []) => 
  api.post('/generate', { episode_id: episodeId, prompt, order_index, history });

export default api; 