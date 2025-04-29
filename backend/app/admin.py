from sqladmin import Admin, ModelView
from app.db.models import Episode, Segment
from app.db.session import engine

class EpisodeAdmin(ModelView, model=Episode):
    column_list = [Episode.id, Episode.title, Episode.created_at]
    
class SegmentAdmin(ModelView, model=Segment):
    column_list = [Segment.id, Segment.episode_id, Segment.segment_type, 
                  Segment.text_content, Segment.audio_path]

def mount_admin(app):
    admin = Admin(app, engine)
    admin.add_view(EpisodeAdmin)
    admin.add_view(SegmentAdmin) 