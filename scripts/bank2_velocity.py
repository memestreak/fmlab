#!/usr/bin/env python3
"""Set bank B's key velocity sensitivities in fmlab-bank2.syx.

Each voice gets one sensitivity (KVS, 0 to 7) for its carriers and one for
its modulators, by kind (Jeremy, 2026-10-24): pianos and keys brighter as
they are struck harder, plucks and mallets a little, organs and pads not
at all. The carriers are each voice's algorithm's, read from
src/dsp/algorithms.ts. Run it, then regenerate src/chapters/fmlabVoices.ts
(see README.md):

    scripts/bank2_velocity.py scripts/fmlab-bank2.syx
"""

import re
import sys
from pathlib import Path

VOICE_BYTES = 128
HEADER_BYTES = 6
OPERATOR_BYTES = 17
KVS_BYTE = 13

# Voice name to (carriers' KVS, modulators' KVS).
SENSITIVITY: dict[str, tuple[int, int]] = {
    # Pianos, Rhodes-type and clavinet: carriers 2, bright modulators 4 to 6.
    "TINE PIANO": (2, 5),
    "SUITCASE": (2, 5),
    "REED PIANO": (2, 4),
    "CLAVINET": (2, 4),
    # Plucks: modulators 3, carriers 1.
    "HARPSICORD": (1, 3),
    "HARP": (1, 3),
    "KOTO": (1, 3),
    # Mallets: modulators 4, carriers 2.
    "TUBE BELLS": (2, 4),
    "CELESTA": (2, 4),
    "MARIMBA": (2, 4),
    "VIBES": (2, 4),
    "GAMELAN": (2, 4),
    # Basses: modulators 3, carriers 1.
    "SOLID BASS": (1, 3),
    "SLAP BASS": (1, 3),
    "RUBBER BAS": (1, 3),
    # Brass: brighter when harder.
    "SOFT BRASS": (1, 3),
    "BRASS STAB": (1, 4),
    # Organs and pads: none. Strings, winds and saws: carriers 1 at most.
    "DRAWBARS": (0, 0),
    "PERC ORGAN": (0, 0),
    "WARM PAD": (0, 0),
    "GLASS PAD": (0, 0),
    "VOX PAD": (0, 0),
    "SWEEP PAD": (0, 0),
    "DARK PAD": (0, 0),
    "BRASS PAD": (0, 0),
    "SAW PAD": (0, 0),
    "HOLLOW PAD": (0, 0),
    "STRINGS": (1, 0),
    "FLUTE": (1, 0),
    "CLARINET": (1, 0),
    "SAW LEAD": (1, 0),
    "SAW BASS": (1, 0),
}


def carriers_by_algorithm(source: str) -> dict[int, set[int]]:
    """Each DX7 algorithm's carriers, from algorithms.ts.

    Args:
        source: The text of src/dsp/algorithms.ts.

    Returns:
        Algorithm number to its carriers' operator numbers (1 to 6).
    """
    found = re.findall(r"\{ number: (\d+), carriers: \[([\d, ]+)\]", source)
    return {int(n): {int(c) for c in cs.split(",")} for n, cs in found}


def set_velocities(bank: bytearray, carriers: dict[int, set[int]]) -> list[str]:
    """Write each voice's KVS into `bank`, and its checksum.

    Args:
        bank: The 4104-byte bank, changed in place.
        carriers: Each algorithm's carriers.

    Returns:
        A line per voice saying what each operator got.
    """
    lines = []
    for v in range(32):
        voice = HEADER_BYTES + v * VOICE_BYTES
        name = " ".join(bank[voice + 118:voice + 128].decode("ascii").split())
        algorithm = (bank[voice + 110] & 31) + 1
        carrier_kvs, modulator_kvs = SENSITIVITY[name]
        got = []
        for number in range(1, 7):
            # Stored OP6 first.
            at = voice + (6 - number) * OPERATOR_BYTES + KVS_BYTE
            kvs = carrier_kvs if number in carriers[algorithm] else modulator_kvs
            bank[at] = (bank[at] & 0b11) | (kvs << 2)
            got.append(kvs)
        lines.append(f"B{v + 1} {name}: algorithm {algorithm}, OP1-6 KVS {got}")
    data = bank[HEADER_BYTES:HEADER_BYTES + 32 * VOICE_BYTES]
    bank[HEADER_BYTES + 32 * VOICE_BYTES] = (-sum(data)) & 0x7F
    return lines


def main() -> None:
    """Set the sensitivities in the bank named on the command line."""
    path = Path(sys.argv[1])
    algorithms = Path(__file__).parent.parent / "src/dsp/algorithms.ts"
    bank = bytearray(path.read_bytes())
    for line in set_velocities(bank, carriers_by_algorithm(algorithms.read_text())):
        print(line)
    path.write_bytes(bytes(bank))


if __name__ == "__main__":
    main()
