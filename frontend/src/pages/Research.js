import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getSources, createSource, updateSource, deleteSource } from '../services/api';

const SourceType = {
  PDF: 'pdf',
  WEB: 'web',
};

const Research = () => {
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    source_type: SourceType.WEB,
    url: '',
    file_path: '',
    content: '',
  });

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    setIsLoading(true);
    try {
      const response = await getSources();
      setSources(response.data);
    } catch (err) {
      setError('Failed to load sources');
      console.error('Error fetching sources:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (source = null) => {
    if (source) {
      setEditingSource(source);
      setFormData({
        title: source.title,
        source_type: source.source_type,
        url: source.url || '',
        file_path: source.file_path || '',
        content: source.content || '',
      });
    } else {
      setEditingSource(null);
      setFormData({
        title: '',
        source_type: SourceType.WEB,
        url: '',
        file_path: '',
        content: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSource(null);
    setFormData({
      title: '',
      source_type: SourceType.WEB,
      url: '',
      file_path: '',
      content: '',
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    try {
      if (editingSource) {
        await updateSource(editingSource.id, formData);
      } else {
        await createSource(formData);
      }
      await fetchSources();
      handleCloseDialog();
    } catch (err) {
      console.error('Error saving source:', err);
    }
  };

  const handleDelete = async (sourceId) => {
    if (window.confirm('Are you sure you want to delete this source?')) {
      try {
        await deleteSource(sourceId);
        await fetchSources();
      } catch (err) {
        console.error('Error deleting source:', err);
      }
    }
  };

  if (isLoading) {
    return (
      <Container>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Typography color="error">{error}</Typography>
      </Container>
    );
  }

  return (
    <Container>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Research Sources</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Source
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>URL/File</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sources.map((source) => (
              <TableRow key={source.id}>
                <TableCell>{source.title}</TableCell>
                <TableCell>{source.source_type}</TableCell>
                <TableCell>{source.url || source.file_path}</TableCell>
                <TableCell>
                  <Tooltip title="Edit">
                    <IconButton onClick={() => handleOpenDialog(source)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton onClick={() => handleDelete(source.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingSource ? 'Edit Source' : 'Add Source'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              fullWidth
              required
            />
            <TextField
              select
              label="Source Type"
              name="source_type"
              value={formData.source_type}
              onChange={handleInputChange}
              fullWidth
              required
            >
              <MenuItem value={SourceType.WEB}>Web Page</MenuItem>
              <MenuItem value={SourceType.PDF}>PDF</MenuItem>
            </TextField>
            {formData.source_type === SourceType.WEB ? (
              <TextField
                label="URL"
                name="url"
                value={formData.url}
                onChange={handleInputChange}
                fullWidth
                required
              />
            ) : (
              <TextField
                label="File Path"
                name="file_path"
                value={formData.file_path}
                onChange={handleInputChange}
                fullWidth
                required
              />
            )}
            <TextField
              label="Content"
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              fullWidth
              multiline
              rows={4}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingSource ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Research; 