import argparse
import logging
from animate import generate_hedra_video

logging.basicConfig(level=logging.INFO)

def main():
    parser = argparse.ArgumentParser(description="Test Hedra video generation")
    parser.add_argument('--image', required=True, help='Path to still image file')
    parser.add_argument('--audio', required=True, help='Path to audio file')
    parser.add_argument('--prompt', required=False, default="Animate the image to the audio.", help='Text prompt for the video')
    parser.add_argument('--aspect_ratio', default='16:9', choices=['16:9', '9:16', '1:1'], help='Aspect ratio')
    parser.add_argument('--resolution', default='540p', choices=['540p', '720p'], help='Resolution')
    parser.add_argument('--duration', type=float, default=None, help='Optional duration in seconds')
    parser.add_argument('--seed', type=int, default=None, help='Optional seed')
    parser.add_argument('--output_dir', default=None, help='Optional output directory')
    args = parser.parse_args()

    try:
        output_path = generate_hedra_video(
            image_path=args.image,
            audio_path=args.audio,
            text_prompt=args.prompt,
            aspect_ratio=args.aspect_ratio,
            resolution=args.resolution,
            duration=args.duration,
            seed=args.seed,
            output_dir=args.output_dir,
        )
        print(f"Video generated and saved to: {output_path}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main() 