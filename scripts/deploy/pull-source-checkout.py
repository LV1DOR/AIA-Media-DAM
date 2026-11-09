"""Fast-forward a private NAS source checkout from a verified Git bundle.

This does not deploy containers, switch releases, or mount identity/media data.
Transport the payload through the existing authenticated SSH private framing.
"""
import base64
import hashlib
import json
import pathlib
import re
import subprocess
import sys

if '--approved-source-pull' not in sys.argv:
    raise SystemExit('Explicit source-pull authorization required')
stream = sys.stdin.buffer
line = stream.readline()
if line != b'AIA_PRIVATE_INPUT_V1\n':
    line = stream.readline()
if line != b'AIA_PRIVATE_INPUT_V1\n':
    raise SystemExit('Private framing failed')
payload = json.load(stream)
commit = payload['commit']
if not re.fullmatch(r'[a-f0-9]{40}', commit):
    raise SystemExit('Invalid main commit')
bundle = base64.b64decode(payload['bundle'], validate=True)
if len(bundle) > 32 * 1024**2 or hashlib.sha256(bundle).hexdigest() != payload['sha256']:
    raise SystemExit('Bundle size or checksum differs')

root = pathlib.Path('/volume1/docker/aia-media-ecosystem')
if root.is_symlink() or root.stat().st_uid != 0 or root.stat().st_mode & 0o777 != 0o700:
    raise SystemExit('Private NAS project root differs')
private, checkout = root / '.private', root / 'source'
if private.is_symlink() or checkout.is_symlink():
    raise SystemExit('Source/private path must not be a symlink')
current = str((root / 'current').resolve())
container_ids = subprocess.check_output(['docker', 'ps', '-q']).decode().split()
if not container_ids:
    raise SystemExit('Expected running application containers')

bundle_path = private / ('git-main-' + commit + '.bundle')
if bundle_path.exists():
    if bundle_path.is_symlink() or hashlib.sha256(bundle_path.read_bytes()).hexdigest() != payload['sha256']:
        raise SystemExit('Existing bundle differs')
else:
    with bundle_path.open('xb') as output:
        output.write(bundle)
    bundle_path.chmod(0o600)

new = not checkout.exists()
if new:
    checkout.mkdir(mode=0o700)
elif not (checkout / '.git').is_dir() or (checkout / '.git').is_symlink():
    raise SystemExit('Existing source path is not the expected Git checkout')

image = 'alpine/git@sha256:6a1fdb962814ca11508ca8d1bab94375b5b7ac4e4a9a40981c29fc32c02f095d'
prefix = ['docker', 'run', '--rm', '--network', 'none', '--read-only',
          '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', '0:0',
          '--tmpfs', '/tmp:rw,nosuid,nodev,noexec,size=16m', '-e', 'HOME=/tmp',
          '-e', 'GIT_CONFIG_NOSYSTEM=1', '-e', 'GIT_CONFIG_GLOBAL=/dev/null',
          '--mount', f'type=bind,src={checkout},dst=/repo',
          '--mount', f'type=bind,src={bundle_path},dst=/incoming/main.bundle,readonly',
          image, '-C', '/repo']


def git(*args):
    result = subprocess.run(prefix + list(args), check=True, capture_output=True, text=True, timeout=60)
    return result.stdout.strip()


origin = 'https://github.com/LV1DOR/AIA-Media-DAM.git'
if new:
    git('init', '--initial-branch=main')
    git('remote', 'add', 'origin', origin)
elif git('status', '--porcelain') or git('branch', '--show-current') != 'main' or git('remote', 'get-url', 'origin') != origin:
    raise SystemExit('Checkout must be clean main with the approved origin')
git('bundle', 'verify', '/incoming/main.bundle')
heads = git('bundle', 'list-heads', '/incoming/main.bundle').splitlines()
if heads != [commit + ' refs/heads/main']:
    raise SystemExit('Bundle does not contain exactly the expected main reference')
git('pull', '--ff-only', '/incoming/main.bundle', 'main')
git('update-ref', 'refs/remotes/origin/main', commit)
git('branch', '--set-upstream-to=origin/main', 'main')
if git('rev-parse', 'HEAD') != commit or git('status', '--porcelain'):
    raise SystemExit('Pulled checkout differs')
if str((root / 'current').resolve()) != current or subprocess.check_output(['docker', 'ps', '-q']).decode().split() != container_ids:
    raise SystemExit('Live release or running containers changed during source pull')
report = {'sourcePulled': True, 'commit': commit, 'bundleSha256': payload['sha256'],
          'checkout': str(checkout), 'origin': origin, 'cleanMain': True,
          'gitHelperImage': image, 'transfer': 'checksummed Git bundle over SSH; fast-forward-only Git pull',
          'liveRelease': current, 'runningApplicationContainersChanged': False,
          'credentialsOrMediaMounted': False, 'productionDeployed': False}
receipt = private / ('source-pull-' + commit + '.json')
receipt.write_text(json.dumps(report, indent=2) + '\n')
receipt.chmod(0o600)
print(json.dumps(report))
