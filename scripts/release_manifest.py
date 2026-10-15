"""Explicit public file lists shared by packaging and audit tools."""
import json
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
WEB_FILES = ['index.html', 'notices.html', 'styles.css', 'app.mjs', 'core.mjs', 'favicon.svg', 'LICENSE', 'ASSET_LICENSE.md', 'THIRD_PARTY_NOTICES.md', '.nojekyll',
             'data/catalog.json', 'data/graph.json', 'data/manifest.json', 'data/examples.json', 'data/prompt-policy.mjs', 'data/handraw-style-LICENSE']
SOURCE_FILES = ['README.md', 'REBUILD.md', 'GITHUB_METADATA.md', 'DEPLOYMENT.md', 'deploy/nginx-static.conf.example', 'requirements.txt', 'start-preview.ps1', '.gitignore', '.gitattributes',
                'scripts/audit_privacy.py', 'scripts/audit_package.py', 'scripts/release_manifest.py', 'scripts/package.py',
                'scripts/download_models.py', 'scripts/features.py', 'scripts/graph.py', 'scripts/parameter_sweep.py', 'scripts/prepare.py', 'scripts/review_sheets.py', 'scripts/verify.py', 'scripts/optimize_avatars.py',
                'tests/core.test.mjs', 'tests/rebuild_smoke.py', 'tests/fixtures/comparison-330.json', 'tests/fixtures/prompt-decisions-parity.json',
                'research/REPORT.md', 'research/comparison.json', 'research/comparison-data.js', 'research/index.html', 'research/model-lock.json', 'research/parameter-sweep.json',
                'screenshots/current-330-desktop.png', 'screenshots/current-330-mobile.png']


def release_paths(kind):
    if kind not in {'source', 'website'}:
        raise ValueError('Unknown release kind')
    manifest = json.loads((ROOT / 'data/manifest.json').read_text(encoding='utf-8'))
    assets = [entry['path'] for entry in manifest['files']]
    for name in assets:
        if not name.startswith(('assets/avatars/', 'assets/references/')) or PurePosixPath(name).suffix.lower() not in {'.png', '.webp', '.jpg', '.jpeg'}:
            raise ValueError('Only library images may enter the asset manifest')
    paths = sorted(set(WEB_FILES + assets + (SOURCE_FILES if kind == 'source' else [])))
    for name in paths:
        relative = PurePosixPath(name)
        path = ROOT / name
        if relative.is_absolute() or '..' in relative.parts or '\\' in name or ':' in name:
            raise ValueError('Unsafe release path')
        if not path.resolve().is_relative_to(ROOT.resolve()) or not path.is_file():
            raise ValueError(f'Missing or external release file: {name}')
    return paths
