"""Patch only the experiment's private upstream checkout with an explicit seed.

The pinned upstream binary otherwise reads /dev/urandom. Keep OMP_NUM_THREADS=1
as sampler initialization order is nondeterministic with parallel execution.
"""
from pathlib import Path
import subprocess
import sys

REVISION = "1fe2a43e3667fb2461736ddb48783ab0cf98a171"
root = Path(sys.argv[1]).resolve()
assert subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip() == REVISION
file = root / "src/random.c"
original = subprocess.check_output(["git", "show", "HEAD:src/random.c"], cwd=root, text=True)
anchor = "static int random_system_state(random_state *state) {\n"
addition = '''    const char *seed_text = getenv("STRONG_EFLOMAL_SEED");
    if (seed_text != NULL) {
        char *end;
        unsigned long long seed = strtoull(seed_text, &end, 10);
        if (*seed_text == '\\0' || *end != '\\0' || seed == 0) {
            fprintf(stderr, "Invalid STRONG_EFLOMAL_SEED\\n");
            exit(2);
        }
        *state = (random_state)seed;
        return 0;
    }
'''
assert original.count(anchor) == 1
patched = original.replace(anchor, anchor + addition)
assert file.read_text() in (original, patched), "unexpected-local-modification"
file.write_text(patched)
print(f"Seed patch applied to {REVISION}")
