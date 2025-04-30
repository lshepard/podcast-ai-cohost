import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Button,
  Grid,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LanguageIcon from '@mui/icons-material/Language';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import { getSources, deleteSource, createSource } from '../services/api';
import SourceContentDialog from '../components/SourceContentDialog';

const SourceType = {
  WEB: 'web',
  PDF: 'pdf',
  TEXT: 'text',
};

const Research = () => {
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [selectedSourceType, setSelectedSourceType] = useState(null);

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

  const handleSourceCreate = async (sourceData) => {
    try {
      await createSource(sourceData);
      await fetchSources();
    } catch (err) {
      console.error('Error creating source:', err);
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
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4">Research Sources</Typography>
        
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<LanguageIcon />}
              onClick={() => {
                setSelectedSourceType(SourceType.WEB);
                setContentDialogOpen(true);
              }}
              sx={{ height: '100px' }}
            >
              Scrape Web Page
            </Button>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={() => {
                setSelectedSourceType(SourceType.PDF);
                setContentDialogOpen(true);
              }}
              sx={{ height: '100px' }}
            >
              Upload PDF
            </Button>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<TextFieldsIcon />}
              onClick={() => {
                setSelectedSourceType(SourceType.TEXT);
                setContentDialogOpen(true);
              }}
              sx={{ height: '100px' }}
            >
              Enter Text
            </Button>
          </Grid>
        </Grid>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>URL/File</TableCell>
              <TableCell>Used in Episodes</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sources.map((source) => (
              <TableRow key={source.id}>
                <TableCell>{source.title}</TableCell>
                <TableCell>
                  <Chip
                    label={source.source_type}
                    size="small"
                    color={source.source_type === 'pdf' ? 'primary' : 'secondary'}
                  />
                </TableCell>
                <TableCell>{source.url || source.file_path}</TableCell>
                <TableCell>
                  {source.episodes && source.episodes.length > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {source.episodes.map(episode => (
                        <Chip
                          key={episode.id}
                          label={episode.title}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Not used in any episodes
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Tooltip title="Edit">
                    <IconButton>
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

      <SourceContentDialog
        open={contentDialogOpen}
        onClose={() => setContentDialogOpen(false)}
        sourceType={selectedSourceType}
        onSubmit={handleSourceCreate}
      />
    </Container>
  );
};

export default Research; 