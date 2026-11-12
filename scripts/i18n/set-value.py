#!/usr/bin/env python3
"""Set the French value of one exact key in the named dictionaries.

  python3 scripts/i18n/set-value.py "Manifesto Line" "Phrase manifeste" brand-document.js ...

Used to settle a term that two dictionaries rendered differently. The key
must already exist in each file; nothing is added. Handles a value on the
same line or on the line after the key.
"""
import json, re, sys, os
key, val, files = sys.argv[1], sys.argv[2], sys.argv[3:]
kq = json.dumps(key, ensure_ascii=False)
for f in files:
    p = os.path.join('js/i18n/fr', f)
    lines = open(p, encoding='utf8').read().split('\n')
    hit = 0
    for i, l in enumerate(lines):
        if not l.lstrip().startswith(kq + ':'):
            continue
        indent = l[:len(l) - len(l.lstrip())]
        rest = l.lstrip()[len(kq) + 1:].strip()
        if rest == '':
            nxt = lines[i + 1]
            comma = ',' if nxt.rstrip().endswith(',') else ''
            lines[i + 1] = nxt[:len(nxt) - len(nxt.lstrip())] + json.dumps(val, ensure_ascii=False) + comma
        else:
            comma = ',' if rest.endswith(',') else ''
            lines[i] = indent + kq + ': ' + json.dumps(val, ensure_ascii=False) + comma
        hit += 1
    if hit != 1:
        sys.exit(f'{f}: expected exactly one entry for {kq}, found {hit}')
    open(p, 'w', encoding='utf8').write('\n'.join(lines))
    print(f'{f}: {kq} set')
