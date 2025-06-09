import { useState, useEffect, useRef } from 'react';

const useVideoRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState(null);
  const [error, setError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const streamRef = useRef(null);
  
  // Start recording
  const startRecording = async () => {
    try {
      // Reset state
      setVideoBlob(null);
      setError(null);
      videoChunksRef.current = [];
      
      // Get camera and microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: true 
      });
      streamRef.current = stream;
      
      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      
      // Add data handler
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };
      
      // When recording stops, create the video blob
      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        setVideoBlob(videoBlob);
        
        // Stop all tracks in the stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError(err.message || 'Failed to start recording');
      console.error('Error starting recording:', err);
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);
  
  return {
    isRecording,
    videoBlob,
    error,
    startRecording,
    stopRecording,
    setVideoBlob,
  };
};

export default useVideoRecorder; 