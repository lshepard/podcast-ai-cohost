from sqladmin import Admin, ModelView
from app.db.models import Episode, Segment, Source
from app.db.session import engine

class EpisodeAdmin(ModelView, model=Episode):
    column_list = [Episode.id, Episode.title, Episode.created_at, Episode.description]
    
class SegmentAdmin(ModelView, model=Segment):
    column_list = [Segment.id, Segment.episode_id, Segment.segment_type, 
                  Segment.text_content, Segment.audio_path, Segment.raw_audio_path, Segment.duration]

class SourceAdmin(ModelView, model=Source):
    column_list = [Source.id, Source.title, Source.source_type, Source.url, 
                  Source.file_path, Source.token_count, Source.created_at, Source.updated_at]

def mount_admin(app):
    admin = Admin(app, engine)
    admin.add_view(EpisodeAdmin)
    admin.add_view(SegmentAdmin)
    admin.add_view(SourceAdmin) 