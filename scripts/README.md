# scripts

Offline tools, run by hand. Nothing here is shipped.

## dx7_voices.py

Converts DX7 factory voices into the sandbox's units and writes
`src/chapters/dx7Factory.ts`. It needs a 32-voice DX7 bank in the packed
.syx format; ROM1A is widely copied (for example `roms/ROM1A.SYX` in
github.com/mmontag/dx7-synth-js). The .syx is Yamaha's and is never
committed; only the converted numbers are.

```sh
scripts/dx7_voices.py ROM1A.SYX src/chapters/dx7Factory.ts
```

converts all 32 voices in the bank's order (the sandbox's dropdown);
names after the paths convert only those.

Standard library only. Its tests use pytest:

```sh
cd scripts
uv run --no-project --with pytest pytest test_dx7_voices.py
uvx ruff check .
uvx --with pytest mypy --strict dx7_voices.py test_dx7_voices.py
```
