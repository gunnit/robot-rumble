#!/usr/bin/env python3
"""Build index.html, the single file the kids double-click.

Takes dev.html as the page shell and swaps its src loader for every file listed in
src/manifest.json, inlined in order (one <script> per file, exactly like dev.html loads them).
Usage: python3 build.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
LOADER = '<!-- src loader'


def read(*path):
    with open(os.path.join(ROOT, *path), encoding='utf-8') as f:
        return f.read()


def main():
    shell = read('dev.html')
    start = shell.index(LOADER)
    end = shell.index('</script>', start) + len('</script>')
    files = json.loads(read('src', 'manifest.json'))
    scripts = ['<!-- BUILT by build.py from src/manifest.json: edit the src/ files and rebuild, not this file -->']
    for name in files:
        code = read('src', name)
        code = re.sub(r'</(script)', r'<\\/\1', code, flags=re.I)  # keep "</script" inside code from closing the tag
        scripts.append('<script>\n// ---- src/%s ----\n%s%s</script>' % (name, code, '' if code.endswith('\n') else '\n'))
    out = os.path.join(ROOT, 'index.html')
    with open(out, 'w', encoding='utf-8', newline='\n') as f:  # LF on every OS (Windows too)
        f.write(shell[:start] + '\n'.join(scripts) + shell[end:])
    print('built index.html from %d files (%d bytes)' % (len(files), os.path.getsize(out)))


if __name__ == '__main__':
    main()
