"""Inspect the explicit archive manifest and scan text for private paths/keys."""
import re, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(ROOT/'output/style-path-explorer-source.zip') as z:
    forbidden=[n for n in z.namelist() if any(t in n for t in ('.runtime/','.venv/','.env','PROJECT_SPEC','private-notes/','output/','__pycache__/'))]
    assert not forbidden,forbidden
    pattern=re.compile(r'(?:[CDHE]:[/\\])|(?:sk-[A-Za-z0-9_-]{20,})')
    findings=[]
    for n in z.namelist():
        if n.endswith(('.md','.json','.js','.mjs','.py','.html','.ps1')):
            content=z.read(n).decode('utf-8',errors='strict')
            findings.extend((n,m.group()) for m in pattern.finditer(content))
    assert not findings,findings
    print(f'Archive audit passed: {len(z.namelist())} files; no runtime caches, planning notes, private drive paths or key-pattern matches.')
