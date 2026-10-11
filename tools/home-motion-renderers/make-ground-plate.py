from pathlib import Path
import subprocess
import imageio_ffmpeg

root = Path(__file__).resolve().parent
(root / 'verify').mkdir(parents=True, exist_ok=True)
source = root / 'downloads/pexels-telescope-9121273-4k.mp4'
dest = root / 'telescope-ground-background.mp4'
# Crop only the unobstructed right-hand field, removing the observer and telescope.
# This live-action distant background is graded into a subdued blue-hour backdrop;
# all near optical instrument movement is rendered by a perspective camera.
filters = ('crop=1536:864:2304:1296,scale=1920:1080,'
           'eq=brightness=-0.10:contrast=1.06:saturation=0.52:gamma=0.9,'
           'colorbalance=bs=0.04:bm=0.045:rs=-0.03:rm=-0.035,'
           'fps=30,setsar=1,format=yuv420p')
result = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-y',
                         '-i', str(source), '-t', '8', '-vf', filters, '-an', '-c:v', 'libx264',
                         '-preset', 'medium', '-crf', '21', '-movflags', '+faststart', str(dest)],
                        capture_output=True, text=True, encoding='utf-8', errors='replace')
if result.returncode:
    raise RuntimeError(result.stderr)
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-y',
                '-ss', '2', '-i', str(dest), '-frames:v', '1', str(root / 'verify/ground-plate.jpg')], check=True)
print(dest.name)
