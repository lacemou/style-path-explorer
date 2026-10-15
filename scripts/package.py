"""Build source and website ZIPs from the explicit public manifest."""
import hashlib
import zipfile
from audit_privacy import findings
from release_manifest import ROOT, release_paths


def main():
    releases = {kind: release_paths(kind) for kind in ('source', 'website')}
    for paths in releases.values():
        for name in paths:
            if findings(name, (ROOT / name).read_bytes()):
                raise SystemExit(f'Privacy check failed for {name}; run audit_privacy.py for redacted locations.')
    out = ROOT / 'output'
    out.mkdir(exist_ok=True)
    for kind, paths in releases.items():
        dest = out / f'style-path-explorer-{kind}.zip'
        temporary = dest.with_suffix('.zip.tmp')
        with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name in paths:
                archive.write(ROOT / name, name)
        temporary.replace(dest)
        print(kind, len(paths), 'files', dest.stat().st_size, 'bytes', hashlib.sha256(dest.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
