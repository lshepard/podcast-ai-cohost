import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogTitle,
  TextField,
  CircularProgress
} from '@mui/material';

const EditDialog = ({ open, segment, onClose, onSave, isGenerating }) => {
  const [text, setText] = useState(segment?.text_content || '');

  useEffect(() => {
    if (segment) {
      setText(segment.text_content || '');
    }
  }, [segment]);

  const handleSave = () => {
    onSave(text);
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>
        {segment?.segment_type === 'human' 
          ? 'Edit Transcription' 
          : segment?.segment_type === 'source'
          ? 'Edit Source Content'
          : 'Edit AI Response'}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          fullWidth
          multiline
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          variant="outlined"
          disabled={isGenerating}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} color="primary">
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          color="primary" 
          variant="contained"
          disabled={isGenerating}
          startIcon={isGenerating ? <CircularProgress size={20} /> : null}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditDialog; 