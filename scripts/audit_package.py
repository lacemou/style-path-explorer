"""Verify both ZIPs against the public manifest, current bytes and privacy rules."""
import zipfile
from audit_privacy import findings
from release_manifest import ROOT, release_paths


def audit_archives():
    hits = []
    for kind in ('source', 'website'):
        expected = set(release_paths(kind))
        with zipfile.ZipFile(ROOT / f'output/style-path-explorer-{kind}.zip') as archive:
            names = archive.namelist()
            if len(names) != len(set(names)) or set(names) != expected:
                raise ValueError(f'{kind} ZIP does not match the public manifest')
            for name in names:
                content = archive.read(name)
                if content != (ROOT / name).read_bytes():
                    raise ValueError(f'{kind} ZIP contains stale bytes: {name}')
                hits.extend(findings(f'{kind}.zip/{name}', content))
        print(f'{kind} ZIP: {len(expected)} files; exact manifest and current bytes verified.')
    return hits


if __name__ == '__main__':
    issues = audit_archives()
    for name, line, kind in issues:
        print(f'{name}:{line}: {kind} (value redacted)')
    raise SystemExit(1 if issues else 0)
