import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  List,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  CardActions,
  Collapse,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Article as ArticleIcon,
  Mic as MicIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { searchContent } from '../services/api';

const Search = () => {
  const [query, setQuery] = useState('');
  const [contentType, setContentType] = useState('all');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    
    try {
      const response = await searchContent(query, contentType);
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const toggleExpanded = (itemId, type) => {
    const key = `${type}-${itemId}`;
    setExpandedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getSegmentIcon = (segmentType) => {
    if (segmentType === 'human') return <PersonIcon />;
    if (segmentType === 'source') return <ArticleIcon />;
    return <BotIcon />;
  };

  const getSegmentColor = (segmentType) => {
    if (segmentType === 'human') return 'primary';
    if (segmentType === 'source') return 'success';
    return 'secondary';
  };

  const getSourceIcon = (sourceType) => {
    switch (sourceType) {
      case 'pdf':
        return <ArticleIcon />;
      case 'web':
        return <ArticleIcon />;
      default:
        return <ArticleIcon />;
    }
  };

  const highlightText = (text, searchTerm) => {
    if (!text || !searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} style={{ backgroundColor: '#ffeb3b', fontWeight: 'bold' }}>
          {part}
        </span>
      ) : part
    );
  };

  const truncateText = (text, maxLength = 200) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const renderEpisodeResults = () => {
    if (!results?.episodes?.length) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
          <ArticleIcon sx={{ mr: 1 }} />
          Episodes ({results.episodes.length})
        </Typography>
        <List>
          {results.episodes.map((episode) => (
            <Card key={episode.id} sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" component="div">
                  {highlightText(episode.title, query)}
                </Typography>
                {episode.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {highlightText(truncateText(episode.description), query)}
                  </Typography>
                )}
                {episode.notes && (
                  <Box sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      onClick={() => toggleExpanded(episode.id, 'episode')}
                      endIcon={expandedItems[`episode-${episode.id}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    >
                      {expandedItems[`episode-${episode.id}`] ? 'Hide Notes' : 'Show Notes'}
                    </Button>
                    <Collapse in={expandedItems[`episode-${episode.id}`]}>
                      <Typography variant="body2" sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                        {highlightText(episode.notes, query)}
                      </Typography>
                    </Collapse>
                  </Box>
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  onClick={() => navigate(`/episodes/${episode.id}`)}
                >
                  Open Episode
                </Button>
              </CardActions>
            </Card>
          ))}
        </List>
      </Box>
    );
  };

  const renderSegmentResults = () => {
    if (!results?.segments?.length) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
          <MicIcon sx={{ mr: 1 }} />
          Segments ({results.segments.length})
        </Typography>
        <List>
          {results.segments.map((segment) => (
            <Card key={segment.id} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  {getSegmentIcon(segment.segment_type)}
                  <Chip
                    label={segment.segment_type}
                    size="small"
                    sx={{ ml: 1 }}
                    color={getSegmentColor(segment.segment_type)}
                  />
                  <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                    Episode {segment.episode_id} • Segment {segment.order_index}
                  </Typography>
                </Box>
                <Typography variant="body1">
                  {highlightText(truncateText(segment.text_content), query)}
                </Typography>
                {segment.text_content && segment.text_content.length > 200 && (
                  <Button
                    size="small"
                    onClick={() => toggleExpanded(segment.id, 'segment')}
                    endIcon={expandedItems[`segment-${segment.id}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    sx={{ mt: 1 }}
                  >
                    {expandedItems[`segment-${segment.id}`] ? 'Show Less' : 'Show More'}
                  </Button>
                )}
                <Collapse in={expandedItems[`segment-${segment.id}`]}>
                  <Typography variant="body2" sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                    {highlightText(segment.text_content, query)}
                  </Typography>
                </Collapse>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  onClick={() => navigate(`/episodes/${segment.episode_id}`)}
                >
                  Go to Episode
                </Button>
              </CardActions>
            </Card>
          ))}
        </List>
      </Box>
    );
  };

  const renderSourceResults = () => {
    if (!results?.sources?.length) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
          <ArticleIcon sx={{ mr: 1 }} />
          Sources ({results.sources.length})
        </Typography>
        <List>
          {results.sources.map((source) => (
            <Card key={source.id} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  {getSourceIcon(source.source_type)}
                  <Chip
                    label={source.source_type}
                    size="small"
                    sx={{ ml: 1 }}
                  />
                </Box>
                <Typography variant="h6" component="div">
                  {highlightText(source.title, query)}
                </Typography>
                {source.summary && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {highlightText(truncateText(source.summary), query)}
                  </Typography>
                )}
                {source.content && (
                  <Box sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      onClick={() => toggleExpanded(source.id, 'source')}
                      endIcon={expandedItems[`source-${source.id}`] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    >
                      {expandedItems[`source-${source.id}`] ? 'Hide Content' : 'Show Content'}
                    </Button>
                    <Collapse in={expandedItems[`source-${source.id}`]}>
                      <Typography variant="body2" sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                        {highlightText(truncateText(source.content, 500), query)}
                      </Typography>
                    </Collapse>
                  </Box>
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  onClick={() => navigate(`/research`)}
                >
                  View in Research
                </Button>
              </CardActions>
            </Card>
          ))}
        </List>
      </Box>
    );
  };

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Search Content
      </Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            label="Search query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter search terms..."
            variant="outlined"
          />
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Content Type</InputLabel>
            <Select
              value={contentType}
              label="Content Type"
              onChange={(e) => setContentType(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="episodes">Episodes</MenuItem>
              <MenuItem value="segments">Segments</MenuItem>
              <MenuItem value="sources">Sources</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
          >
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {results && (
        <Box>
          {!results.episodes?.length && !results.segments?.length && !results.sources?.length ? (
            <Alert severity="info">
              No results found for "{query}". Try different search terms or content types.
            </Alert>
          ) : (
            <>
              {renderEpisodeResults()}
              {renderSegmentResults()}
              {renderSourceResults()}
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

export default Search; 