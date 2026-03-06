import cv2
import mediapipe as mp
import numpy as np

# Input/output paths
input_video_path = "data/episodes/6/segments/150_video_ff21a161.mp4"
background_image_path = "backgrounds/background-reversed.png"
output_video_path = "output_with_background-3.mp4"

# Load MediaPipe
mp_selfie_segmentation = mp.solutions.selfie_segmentation
segmenter = mp_selfie_segmentation.SelfieSegmentation(model_selection=1)

# Load video and get properties
cap = cv2.VideoCapture(input_video_path)
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = cap.get(cv2.CAP_PROP_FPS)

# Resize background to match video
bg_image = cv2.imread(background_image_path)
bg_image = cv2.resize(bg_image, (width, height))

# Output video writer
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))

# Process video frame-by-frame
while cap.isOpened():
    success, frame = cap.read()
    if not success:
        break

    # Convert to RGB and segment
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = segmenter.process(rgb_frame)

    # Use soft mask for alpha blending
    alpha = results.segmentation_mask  # values between 0.0 and 1.0
    # Apply Gaussian blur to the alpha mask
    alpha = cv2.GaussianBlur(alpha, (21, 21), 0)
    foreground = frame.astype(np.float32) / 255.0
    background = bg_image.astype(np.float32) / 255.0
    alpha = np.expand_dims(alpha, axis=-1)
    composite = alpha * foreground + (1 - alpha) * background
    composite = (composite * 255).astype(np.uint8)

    # Write frame to output
    out.write(composite)

cap.release()
out.release()
segmenter.close()
print(f"✅ Done! Saved to: {output_video_path}")
