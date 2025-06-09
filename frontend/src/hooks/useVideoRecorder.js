import { useState, useEffect, useRef } from 'react';

const useVideoRecorder = (externalStream = null) => {
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState(null);
  const [error, setError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const streamRef = useRef(null);
  const usedExternalStream = useRef(false);
  
  // Start recording
  const startRecording = async () => {
    try {
      // Reset state
      setVideoBlob(null);
      setError(null);
      videoChunksRef.current = [];
      
      let stream = externalStream;
      if (stream) {
        usedExternalStream.current = true;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: true 
        });
        streamRef.current = stream;
        usedExternalStream.current = false;
      }
      
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
        
        // Only stop tracks if we created the stream
        if (streamRef.current && !usedExternalStream.current) {
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
      if (streamRef.current && !usedExternalStream.current) {
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