#!/usr/bin/env python3
"""
Batch-generate the 24 remaining archetype illustrations via OpenAI gpt-image-1.

Reads the OPENAI_API_KEY env var (NEVER commits the key). Generates 12 metaphor
scenes (slug.png) + 12 expression characters (expression-<slug>.png) at 1024x1024
with transparent background, matching the QB illustration style lock from the
existing 12 personality illustrations.

Usage:
    export OPENAI_API_KEY=sk-...
    python3 scripts/gen-archetype-batch.py [--only runner,hand,...]
"""
import os, sys, json, base64, time, argparse, urllib.request, urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = Path(__file__).resolve().parent.parent
OUT  = ROOT / 'img' / 'archetype'
OUT.mkdir(parents=True, exist_ok=True)
API_KEY = os.environ.get('OPENAI_API_KEY')
if not API_KEY:
    sys.exit('OPENAI_API_KEY not set in env')

STYLE = (
    "Flat 2D vector editorial cartoon. "
    "Clean bold black line art outlines (color #2D1521). "
    "Solid color fills only. NO gradients, NO shading, NO 3D effects, NO crosshatching. "
    "Strict palette: forest green #5B7E6A, peach skin #E89380, coral red #DC6B52, "
    "mustard yellow #D4B85A, rust brown #B8704D, lavender #B8A0C7, soft pink #F4C4D0, "
    "black outline #2D1521. Simplified slightly cartoony proportions. "
    "Single figure or scene composition centered, fills the frame top to bottom. "
    "Transparent background. Square 1:1."
)

# 12 metaphor scenes (saved as <slug>.png) and 12 expressions (saved as expression-<slug>.png)
JOBS = [
    # set 2 - metaphor scenes
    ('runner',     '<slug>',            'A runner crouched at the starting block, head down with intense focus, fingers planted on the ground, weight forward, frozen at the moment before explosion. Single muscular athlete figure dominating the frame.'),
    ('hand',       '<slug>',            'A single open human hand offered in cold winter air, fingers gently spread, palm up, generously reaching out. Detail of the hand and forearm prominently framed. Snowflakes optional.'),
    ('moon',       '<slug>',            'A pair of human cupped hands holding a glowing crescent moon, reverent gesture, the moon glowing softly between the palms. Hands and moon centered and dominant.'),
    ('monk',       '<slug>',            'A hooded monk reading by candlelight at night, profile or three-quarter view, head bent over an open book, single candle flame illuminating the face. Cloaked figure, contemplative.'),
    ('canvas',     '<slug>',            'An artist standing before a blank rectangular canvas at dawn, brush poised in raised hand, contemplating the empty surface. Side view, artist on one side and blank canvas dominating the frame.'),
    ('map',        '<slug>',            'A weathered traveler unfolding a worn paper map, distant road or horizon line visible behind them, ready to leave. Half-profile view, map prominent in the foreground.'),
    ('bonfire',    '<slug>',            'A lone figure standing facing a bonfire at night, flames reaching upward in front of them, silhouette against the firelight. Figure and flames centered, fire dominant.'),
    ('circle',     '<slug>',            'Five or six human hands gripping each other in a circular linked arrangement viewed from above, forming a wreath of joined hands. Top-down view, hands dominant filling the frame.'),
    ('letter',     '<slug>',            'A handwritten letter on cream paper being sealed with red wax, two hands holding a quill or stamp visible at the edges, the letter centered and detailed.'),
    ('lion',       '<slug>',            'A regal male lion at rest with a full flowing mane, head up alert but calm, lying down. Front-facing or three-quarter portrait, the lion fills the frame.'),
    ('sunrise',    '<slug>',            'A single figure standing in silhouette facing the sunrise over open water, back to the viewer, arms slightly raised or at sides. Horizon line with sun rising centered.'),
    ('child',      '<slug>',            'A child mid-laugh in the rain, head tilted back, mouth open in pure joy, arms outstretched wide. Joyful kid dominating the frame, raindrops streaking around them.'),

    # set 3 - expressions (saved with expression- prefix)
    ('cool',       'expression-<slug>', 'A cool detached human figure dressed in black, leather jacket and dark shades or hood, expressionless mouth, head and shoulders portrait. Confident neutral pose, single figure centered.'),
    ('elder',      'expression-<slug>', 'An older kind person, grey or white hair, weathered face, round reading glasses, warm faint smile. Head and shoulders portrait, gentle wise expression.'),
    ('distinguish','expression-<slug>', 'A distinguished composed person, formal blazer collar visible, sharp confident eyes, slight commanding smile. Head and shoulders portrait, in command but calm.'),
    ('artist',     'expression-<slug>', 'A smiling artist in their studio, paint-spattered apron, holding a brush near their face, hair slightly messy. Head and shoulders portrait, joyful creative expression.'),
    ('laugh',      'expression-<slug>', 'A person mid-belly-laugh, mouth wide open showing teeth, head tilted back slightly, eyes scrunched with joy. Head and shoulders portrait, pure unrestrained joy.'),
    ('candle',     'expression-<slug>', 'A young child watching a single candle flame, wide reverent eyes lit by the warm glow, small hands cupped near the flame. Head and shoulders portrait, awe.'),
    ('steady',     'expression-<slug>', 'A person extending a single steady reassuring hand toward an off-frame shoulder, calm focused expression, eyes on the recipient. Half-portrait showing the giving gesture.'),
    ('athlete',    'expression-<slug>', 'An athlete mid-effort, drenched in sweat with droplets, intense determined eyes, mouth slightly parted catching breath, jaw set. Head and shoulders portrait, peak exertion.'),
    ('eyes',       'expression-<slug>', 'A close-up portrait emphasizing penetrating mysterious eyes that see more than they show. Head and shoulders portrait, calm intense gaze, slight knowing expression.'),
    ('warm',       'expression-<slug>', 'A weather-worn person with a warm crinkled smile, sun-creases around the eyes, salt-and-pepper hair, gentle generous expression. Head and shoulders portrait, lived-in face.'),
    ('hiker',      'expression-<slug>', 'A hiker grinning in the wild, backpack strap visible on shoulder, hair tousled by wind, weather-worn cheeks. Head and shoulders portrait, energetic outdoorsy joy.'),
    ('sensual',    'expression-<slug>', 'A person with long flowing hair, sensual stillness, eyes closed or distant, peaceful intense expression, head slightly tilted. Head and shoulders portrait, contemplative.'),
]


def generate_one(slug, pattern, concept):
    target = OUT / (pattern.replace('<slug>', slug) + '.png')
    prompt = STYLE + ' ' + concept

    body = json.dumps({
        'model': 'gpt-image-1',
        'prompt': prompt,
        'n': 1,
        'size': '1024x1024',
        'background': 'transparent',
        'output_format': 'png',
    }).encode('utf-8')

    req = urllib.request.Request(
        'https://api.openai.com/v1/images/generations',
        data=body,
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )

    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read())
            b64 = data['data'][0]['b64_json']
            target.write_bytes(base64.b64decode(b64))
            return slug, target, None
        except urllib.error.HTTPError as e:
            err = e.read().decode('utf-8', errors='ignore')[:300]
            if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(2 ** attempt * 3)
                continue
            return slug, target, f'HTTP {e.code}: {err}'
        except Exception as e:
            if attempt < 3:
                time.sleep(2 ** attempt * 3)
                continue
            return slug, target, str(e)
    return slug, target, 'exhausted retries'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='comma-separated slugs to generate')
    ap.add_argument('--parallel', type=int, default=3, help='concurrent requests')
    args = ap.parse_args()

    jobs = JOBS
    if args.only:
        only = set(args.only.split(','))
        jobs = [j for j in JOBS if j[0] in only]
        if not jobs:
            sys.exit(f'No matching slugs in --only: {only}')

    print(f'Generating {len(jobs)} images, {args.parallel} parallel')
    done = 0; failed = []
    with ThreadPoolExecutor(max_workers=args.parallel) as ex:
        futs = [ex.submit(generate_one, *j) for j in jobs]
        for fut in as_completed(futs):
            slug, path, err = fut.result()
            done += 1
            status = 'OK ' if err is None else 'FAIL'
            extra = f'  ({err})' if err else f'  -> {path.name}'
            print(f'  [{done:2d}/{len(jobs)}] {status} {slug:<14}{extra}')
            if err: failed.append((slug, err))

    if failed:
        print(f'\n{len(failed)} failed:')
        for s,e in failed:
            print(f'  {s}: {e[:120]}')
        sys.exit(1)
    print(f'\nAll {len(jobs)} generated.')


if __name__ == '__main__':
    main()
