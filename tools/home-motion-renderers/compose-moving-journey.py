"""Compose the new camera-motion preview, without still-image zoom or a turntable.

Usage: python compose-moving-journey.py [edit-directory]
The renderer recordings must exist in this directory as telescope-camera.webm
and moon-camera-orbit.webm. Sources remain untouched in downloads/.
"""
from pathlib import Path
import json, re, subprocess, sys
import imageio_ffmpeg

EDIT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
CLIPS = EDIT / 'clips_graded'
CLIPS.mkdir(parents=True, exist_ok=True)
OUTPUT = EDIT / 'stargazer-moving-journey.mp4'
COMMON = ['-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
          '-pix_fmt', 'yuv420p', '-threads', '4', '-movflags', '+faststart']

def run(args):
    result = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', *args],
                            capture_output=True, text=True, encoding='utf-8', errors='replace')
    if result.returncode:
        raise RuntimeError(result.stderr[-6000:])

def duration(path):
    result = subprocess.run([FFMPEG, '-hide_banner', '-i', str(path)],
                            capture_output=True, text=True, encoding='utf-8', errors='replace')
    match = re.search(r'Duration: (\d+):(\d+):(\d+(?:\.\d+)?)', result.stderr)
    if not match:
        # Browser MediaRecorder WebM often has no container duration field.
        return imageio_ffmpeg.count_frames_and_secs(str(path))[1]
    h, m, s = map(float, match.groups())
    return h * 3600 + m * 60 + s

telescope = EDIT / 'telescope-camera.webm'
orbit = EDIT / 'moon-camera-orbit.webm'
returning = EDIT / 'downloads/NASA-5039-moon-to-earth-1080p.mp4'
for source in [telescope, orbit, returning]:
    if not source.is_file():
        raise FileNotFoundError(source)

# CG bridge uses an actual perspective camera dolly through a modeled eyepiece.
# NASA footage retains its own camera trajectory; only playback speed is adjusted.
# The Moon is fixed while the renderer camera circumnavigates 360 degrees.
edl = [
    dict(file=telescope, start=0, length=duration(telescope), speed=1,
         title='第一人称移向目镜并推进', reverse=False),
    dict(file=orbit, start=0, length=duration(orbit), speed=1,
         title='连续接近月球并环绕一周，仅一次月球主镜头', reverse=False),
    dict(file=returning, start=20.0, length=10.0, speed=1.1,
         title='飞向地球，省略再次掠过月球的画面', reverse=False),
    dict(file=telescope, start=0, length=4.0, speed=1,
         title='从目镜退回地面观星视角', reverse=True),
]

segments = []
rendered_paths = []
offset = 0.0
for i, shot in enumerate(edl):
    length = shot['length'] / shot['speed']
    # Each segment is encoded once with brief optical blink cuts; final concat
    # copies the encoded streams instead of re-encoding the entire movie.
    filters = ['setpts=PTS-STARTPTS']
    if shot['reverse']:
        filters.append('reverse')
    filters += [f"setpts=PTS/{shot['speed']}", 'fps=30',
                'scale=1920:1080:force_original_aspect_ratio=decrease',
                'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black', 'setsar=1',
                'format=yuv420p']
    if i > 0:
        filters.append('fade=t=in:st=0:d=0.12')
    if i < len(edl) - 1:
        filters.append(f'fade=t=out:st={max(0,length-.12):.6f}:d=0.12')
    destination = CLIPS / f'{i+1:02d}.mp4'
    print(f"Rendering {i+1}/{len(edl)}: {shot['title']}", flush=True)
    run(['-ss', str(shot['start']), '-t', str(shot['length']), '-i', str(shot['file']),
         '-vf', ','.join(filters), *COMMON, str(destination)])
    actual = duration(destination)
    rendered_paths.append(destination)
    segments.append(dict(shot=i+1, title=shot['title'], source=shot['file'].name,
                         source_start=shot['start'], source_length=shot['length'],
                         speed=shot['speed'], reverse=shot['reverse'],
                         output_start=round(offset,3), duration=round(actual,3)))
    offset += actual

listing = CLIPS / 'concat.txt'
listing.write_text(''.join(f"file '{p.name}'\n" for p in rendered_paths), encoding='utf-8')
run(['-f', 'concat', '-safe', '0', '-i', str(listing), '-c', 'copy',
     '-movflags', '+faststart', str(OUTPUT)])
run(['-ss', '1.5', '-i', str(OUTPUT), '-frames:v', '1', '-q:v', '2',
     str(EDIT / 'stargazer-moving-poster.jpg')])
metadata = dict(duration=duration(OUTPUT), width=1920, height=1080, fps=30,
                audio=False, bytes=OUTPUT.stat().st_size, chapters=segments,
                status='preview awaiting user approval',
                moon_motion='One continuous approach and camera orbit. No separate lunar approach/flyby chapter.',
                removed=['NASA 4619 lunar approach with orbit line', 'NASA 5039 repeated lunar flyby', 'return eyepiece lunar close-up'],
                nature='Creative CG first-person optical bridge + NASA scientific data visualization')
(EDIT / 'moving-film-metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(metadata, ensure_ascii=False), flush=True)
