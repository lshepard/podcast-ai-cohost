import os
import time
import logging
from dotenv import load_dotenv
from typing import Optional
import requests

logger = logging.getLogger(__name__)

class HedraSession(requests.Session):
    def __init__(self, api_key: str):
        super().__init__()
        self.base_url: str = "https://api.hedra.com/web-app/public"
        self.headers["x-api-key"] = api_key

    def prepare_request(self, request: requests.Request) -> requests.PreparedRequest:
        request.url = f"{self.base_url}{request.url}"
        return super().prepare_request(request)

def generate_hedra_video(
    image_path: str,
    audio_path: str,
    text_prompt: str,
    aspect_ratio: str,
    resolution: str,
    duration: Optional[float] = None,
    seed: Optional[int] = None,
    output_dir: Optional[str] = None,
) -> str:
    """
    Generate a video using the Hedra API from a still image and audio segment.

    Args:
        image_path: Path to the still image file.
        audio_path: Path to the audio file.
        text_prompt: Text prompt describing the video content.
        aspect_ratio: Aspect ratio for the video ('16:9', '9:16', '1:1').
        resolution: Resolution for the video ('540p', '720p').
        duration: Optional duration for the video in seconds.
        seed: Optional seed for reproducibility.
        output_dir: Optional directory to save the output video.

    Returns:
        Path to the downloaded video file.

    Raises:
        Exception: If any step fails.
    """
    load_dotenv()
    api_key = os.getenv("HEDRA_API_KEY")
    if not api_key:
        raise Exception("HEDRA_API_KEY not found in environment variables or .env file.")

    session = HedraSession(api_key=api_key)
    logger.info("Using Hedra API at %s", session.base_url)

    # Get model id (hardcoded fallback as in CLI)
    try:
        model_id = session.get("/models").json()[0]["id"]
        logger.info("Got model id %s", model_id)
    except Exception:
        model_id = "d1dd37a3-e39a-4854-a298-6510289f9cf2"
        logger.warning("Falling back to default model id %s", model_id)

    # Upload image
    image_resp = session.post(
        "/assets",
        json={"name": os.path.basename(image_path), "type": "image"},
    )
    if not image_resp.ok:
        logger.error("Error creating image asset: %d %s", image_resp.status_code, image_resp.text)
        raise Exception(f"Error creating image asset: {image_resp.text}")
    image_id = image_resp.json()["id"]
    with open(image_path, "rb") as f:
        upload_resp = session.post(f"/assets/{image_id}/upload", files={"file": f})
        upload_resp.raise_for_status()
    logger.info("Uploaded image asset %s", image_id)

    # Upload audio
    audio_resp = session.post(
        "/assets", json={"name": os.path.basename(audio_path), "type": "audio"}
    )
    if not audio_resp.ok:
        logger.error("Error creating audio asset: %d %s", audio_resp.status_code, audio_resp.text)
        raise Exception(f"Error creating audio asset: {audio_resp.text}")
    audio_id = audio_resp.json()["id"]
    with open(audio_path, "rb") as f:
        upload_resp = session.post(f"/assets/{audio_id}/upload", files={"file": f})
        upload_resp.raise_for_status()
    logger.info("Uploaded audio asset %s", audio_id)

    # Prepare generation request
    gen_data = {
        "type": "video",
        "ai_model_id": model_id,
        "start_keyframe_id": image_id,
        "audio_id": audio_id,
        "generated_video_inputs": {
            "text_prompt": text_prompt,
            "resolution": resolution,
            "aspect_ratio": aspect_ratio,
        },
    }
    if duration is not None:
        gen_data["generated_video_inputs"]["duration_ms"] = int(duration * 1000)
    if seed is not None:
        gen_data["generated_video_inputs"]["seed"] = seed

    gen_resp = session.post("/generations", json=gen_data)
    if not gen_resp.ok:
        logger.error("Error submitting generation: %d %s", gen_resp.status_code, gen_resp.text)
        raise Exception(f"Error submitting generation: {gen_resp.text}")
    gen_id = gen_resp.json()["id"]
    logger.info("Submitted generation job %s", gen_id)

    # Poll for completion
    while True:
        status_resp = session.get(f"/generations/{gen_id}/status")
        if not status_resp.ok:
            logger.error("Error polling status: %d %s", status_resp.status_code, status_resp.text)
            raise Exception(f"Error polling status: {status_resp.text}")
        status_data = status_resp.json()
        status = status_data["status"]
        logger.info("Generation status: %s", status)
        if status in ["complete", "error"]:
            break
        time.sleep(5)

    if status == "complete" and status_data.get("url"):
        download_url = status_data["url"]
        output_filename_base = status_data.get("asset_id", gen_id)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            output_filename = os.path.join(output_dir, f"{output_filename_base}.mp4")
        else:
            output_filename = f"{output_filename_base}.mp4"
        logger.info(f"Generation complete. Downloading video from {download_url} to {output_filename}")
        try:
            with requests.get(download_url, stream=True) as r:
                r.raise_for_status()
                with open(output_filename, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
            logger.info(f"Successfully downloaded video to {output_filename}")
            return output_filename
        except Exception as e:
            logger.error(f"Failed to download video: {e}")
            raise
    elif status == "error":
        logger.error(f"Video generation failed: {status_data.get('error_message', 'Unknown error')}")
        raise Exception(f"Video generation failed: {status_data.get('error_message', 'Unknown error')}")
    else:
        logger.warning(f"Video generation finished with status '{status}' but no download URL was found.")
        raise Exception(f"Video generation finished with status '{status}' but no download URL was found.") 