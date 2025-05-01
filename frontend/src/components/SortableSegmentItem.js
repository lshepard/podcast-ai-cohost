import React, { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SegmentItem from './SegmentItem';

const SortableSegmentItem = ({ 
  id, 
  segment, 
  episodeId, 
  onDelete, 
  onUpdate, 
  apiBaseUrl, 
  playNext,
  playAllEnabled,
  onPlay
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 0 : 1,
  };
  
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <SegmentItem
        segment={segment}
        episodeId={episodeId}
        onDelete={onDelete}
        onUpdate={onUpdate}
        apiBaseUrl={apiBaseUrl}
        dragHandleProps={listeners}
        isDragging={isDragging}
        playNext={playNext}
        playAllEnabled={playAllEnabled}
        onPlay={onPlay}
      />
    </div>
  );
};

export default memo(SortableSegmentItem); 