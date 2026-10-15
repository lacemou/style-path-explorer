"""Scan public files, Git history and release ZIPs without printing secrets."""
import argparse
import io
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {'.md', '.txt', '.json', '.js', '.mjs', '.cjs', '.py', '.html', '.css', '.svg', '.ps1', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf', '.sh', '.bat', '.cmd', '.csv', '.xml', '.sql', '.log', '.rst'}
PATTERNS = {
    'absolute-user-path': re.compile(r'(?i)\b[A-Z]:[\\/][^\s\x22\x27<>]+|/(?:Users|home|root)/[^\s\x22\x27<>]+'),
    'private-key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'provider-key': re.compile(r'\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b'),
    'bearer-token': re.compile(r'(?i)bearer\s+[A-Za-z0-9_.=-]{20,}'),
    'credential-assignment': re.compile(r'(?i)(?:api[_-]?key|password|secret|access[_-]?token)\s*[:=]\s*[\x22\x27][^\x22\x27\r\n]{8,}[\x22\x27]'),
    'phone': re.compile(r'(?<![\w\d])1[3-9]\d{9}(?![\w\d])'),
    'email': re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),
}


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])


def findings(name, content):
    leaf = Path(name).name.lower()
    if (leaf == '.env' or leaf.startswith('.env.')) and not leaf.endswith(('.example', '.sample')):
        return [(name, 0, 'private-config-file')]
    if Path(name).suffix.lower() in {'.pem', '.p12', '.pfx', '.key'} or leaf in {'id_rsa', 'id_ed25519'}:
        return [(name, 0, 'private-key-file')]
    if Path(name).suffix.lower() not in TEXT_SUFFIXES and Path(name).name not in {'LICENSE', '.gitignore', '.gitattributes', '.nojekyll'}:
        return []
    text = content.decode('utf-8-sig', errors='strict')
    patterns = dict(PATTERNS)
    # Personal terms stay in local environment configuration, outside the repository.
    for index, term in enumerate(json.loads(os.environ.get('PRIVATE_AUDIT_TERMS', '[]'))):
        if term:
            patterns[f'private-term-{index + 1}'] = re.compile(re.escape(term), re.I)
    hits = []
    for kind, pattern in patterns.items():
        for match in pattern.finditer(text):
            if kind == 'email' and match.group().lower().endswith('@users.noreply.github.com'):
                continue
            hits.append((name, text.count('\n', 0, match.start()) + 1, kind))
    return hits


def history_findings():
    hits, objects = [], {}
    for line in git('rev-list', '--objects', '--all').decode('utf-8').splitlines():
        oid, _, name = line.partition(' ')
        if name:
            objects[oid] = name
    payload = ''.join(oid + '\n' for oid in objects).encode()
    raw = subprocess.run(['git', '-C', str(ROOT), 'cat-file', '--batch'], input=payload, stdout=subprocess.PIPE, check=True).stdout
    stream = io.BytesIO(raw)
    for oid, name in objects.items():
        header = stream.readline().split()
        content = stream.read(int(header[2])); stream.read(1)
        if header[1] == b'blob':
            hits.extend(findings(f'{oid[:8]}/{name}', content))
    for row in git('log', '--all', '--format=%h%x09%ae%x09%ce').decode().splitlines():
        commit, author, committer = row.split('\t')
        if not all(email.lower().endswith('@users.noreply.github.com') for email in (author, committer)):
            hits.append((f'commit/{commit}', 0, 'non-noreply-email'))
    return hits


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--history', action='store_true', help='Inspect all locally reachable Git history')
    parser.add_argument('--archives', action='store_true', help='Inspect both generated release ZIPs')
    args = parser.parse_args()
    from release_manifest import release_paths
    paths = set(release_paths('source'))
    for name in git('ls-files', '--cached', '--others', '--exclude-standard', '-z').decode('utf-8').split('\0'):
        if name and (ROOT / name).is_file():
            paths.add(name)
    hits = []
    for name in sorted(paths):
        hits.extend(findings(name, (ROOT / name).read_bytes()))
    if args.history:
        hits.extend(history_findings())
    if args.archives:
        from audit_package import audit_archives
        hits.extend(audit_archives())
    for name, line, kind in hits:
        print(f'{name}:{line}: {kind} (value redacted)')
    if hits:
        raise SystemExit(f'Privacy audit failed: {len(hits)} findings.')
    print(f'Privacy audit passed: {len(paths)} current files; history={args.history}; archives={args.archives}. Pattern scanning is not a guarantee of absence.')


if __name__ == '__main__':
    main()
