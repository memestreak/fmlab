#!/usr/bin/env python3
"""Convert DX7 factory voices into the sandbox's clean units.

Reads a 32-voice DX7 bank (a .syx file in the packed format), picks the
voices named, and writes them as a TypeScript module of numbers in the
units src/dsp/dx7.ts uses: ratios, cents, dB and seconds. Run once, by
hand; the .syx itself is never committed or shipped. The formulas follow
msfa, the DX7 engine in Dexed (source/msfa/dx7note.cc and env.cc).

    scripts/dx7_voices.py ROM1A.SYX src/chapters/dx7Factory.ts

converts all 32, in the bank's order; name voices after the paths to
convert only those, in that order.
"""

import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path

VOICE_BYTES = 128
HEADER = bytes([0xF0, 0x43, 0x00, 0x09, 0x20, 0x00])
BANK_BYTES = len(HEADER) + 32 * VOICE_BYTES + 2

SILENCE_DB = -96.0
LEVEL_DB_MIN = -72.0
MAX_STAGE_SECONDS = 40.0
MIN_STAGE_SECONDS = 0.001
# One unit of msfa's envelope level: 1/256 of an octave, in dB.
DB_PER_UNIT = 20 * math.log10(2) / 256
# The level an attack jumps to before it starts rising (env.cc).
JUMP_TARGET = 1716
# Below 20, msfa's output-level table (env.cc, levellut).
LEVEL_LUT = (0, 5, 9, 13, 17, 20, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41,
             42, 43, 45, 46)
# A detune step: 12606 / 2^24 of an octave (dx7note.cc, osc_freq), in cents.
CENTS_PER_DETUNE = 12606 / 2**24 * 1200
# Keyboard level scaling: depth 99 is 99 × 329 / 4096 steps of 0.75 dB a
# group of three keys on the linear curve (dx7note.cc, ScaleCurve).
DB_PER_DEPTH = 329 / 4096 * 0.75
# The DX7's break point 0 is A-1, MIDI note 21; 39 is C3, middle C.
BREAK_POINT_NOTE = 21
# The envelope's times, kept to four places; its levels to two.
TIMES = ("attack", "decay1", "decay2", "release")
# The sandbox's ratios, which a fixed frequency's ratio is held within.
RATIO_MIN = 0.5
RATIO_MAX = 61.69
# Middle C, which a fixed-frequency operator is made a ratio of.
MIDDLE_C_HZ = 440 * 2 ** (-9 / 12)
# The LFO's waves, in the DX7's order (byte 116, bits 1 to 3).
LFO_WAVES = ("triangle", "sawDown", "sawUp", "square", "sine", "sampleHold")
# msfa's pitch modulation sensitivity weights, PMS 0 to 7 (dx7note.cc).
PMS_WEIGHTS = (0, 10, 20, 33, 55, 92, 153, 255)
# Dexed's amplitude modulation sensitivities, AMS 0 to 3, over 2^24
# (dx7note.cc, ampmodsenstab): 0, 66, 109 and 255 of 255.
AMS_SHARES = (0.0, 4342338 / 2**24, 7171437 / 2**24, 1.0)


@dataclass(frozen=True)
class RawOperator:
    """One operator of a DX7 voice, as the patch stores it (0 to 99)."""

    rates: tuple[int, int, int, int]
    levels: tuple[int, int, int, int]
    break_point: int
    left_depth: int
    right_depth: int
    left_curve: int
    right_curve: int
    rate_scaling: int
    detune: int
    amp_sensitivity: int
    velocity: int
    output_level: int
    fixed: bool
    coarse: int
    fine: int


@dataclass(frozen=True)
class RawVoice:
    """A DX7 voice as the patch stores it, its operators OP1 first."""

    name: str
    operators: tuple[RawOperator, ...]
    pitch_levels: tuple[int, int, int, int]
    algorithm: int
    feedback: int
    lfo_speed: int
    lfo_delay: int
    lfo_pitch_depth: int
    lfo_amp_depth: int
    lfo_sync: bool
    lfo_wave: int
    pitch_sensitivity: int
    transpose: int


def unpack_operator(data: bytes) -> RawOperator:
    """Unpack one operator's 17 packed bytes.

    Args:
        data: The operator's 17 bytes from a packed voice.

    Returns:
        The operator's parameters.
    """
    return RawOperator(
        rates=(data[0], data[1], data[2], data[3]),
        levels=(data[4], data[5], data[6], data[7]),
        break_point=data[8],
        left_depth=data[9],
        right_depth=data[10],
        left_curve=data[11] & 3,
        right_curve=(data[11] >> 2) & 3,
        rate_scaling=data[12] & 7,
        detune=(data[12] >> 3) & 15,
        amp_sensitivity=data[13] & 3,
        velocity=(data[13] >> 2) & 7,
        output_level=data[14],
        fixed=bool(data[15] & 1),
        coarse=(data[15] >> 1) & 31,
        fine=data[16],
    )


def unpack_voice(data: bytes) -> RawVoice:
    """Unpack one voice's 128 packed bytes.

    Args:
        data: The voice's 128 bytes from a 32-voice bank.

    Returns:
        The voice, its operators reordered OP1 first (the patch stores
        OP6 first).
    """
    operators = tuple(
        unpack_operator(data[i * 17:(i + 1) * 17]) for i in range(6)
    )
    return RawVoice(
        name=" ".join(data[118:128].decode("ascii").split()),
        operators=operators[::-1],
        pitch_levels=(data[106], data[107], data[108], data[109]),
        algorithm=(data[110] & 31) + 1,
        feedback=data[111] & 7,
        # As Dexed's Cartridge::unpackProgram: 112 speed, 113 delay,
        # 114 PMD, 115 AMD; 116 sync (bit 0), wave (1-3) and PMS (4-6).
        lfo_speed=data[112],
        lfo_delay=data[113],
        lfo_pitch_depth=data[114],
        lfo_amp_depth=data[115],
        lfo_sync=bool(data[116] & 1),
        lfo_wave=(data[116] >> 1) & 7,
        pitch_sensitivity=(data[116] >> 4) & 7,
        transpose=data[117],
    )


def unpack_bank(data: bytes) -> list[RawVoice]:
    """Unpack a 32-voice bank.

    Args:
        data: The whole .syx file.

    Returns:
        Its 32 voices.

    Raises:
        ValueError: If it is not a 32-voice DX7 bank.
    """
    if len(data) != BANK_BYTES or not data.startswith(HEADER):
        raise ValueError("not a 32-voice DX7 bank (packed .syx)")
    body = data[len(HEADER):]
    return [
        unpack_voice(body[i * VOICE_BYTES:(i + 1) * VOICE_BYTES])
        for i in range(32)
    ]


def scale_output_level(level: int) -> int:
    """msfa's output level, 0 to 127, for a patch level 0 to 99.

    Args:
        level: A patch level, 0 to 99.

    Returns:
        msfa's scaled level (env.cc, scaleoutlevel).
    """
    return 28 + level if level >= 20 else LEVEL_LUT[level]


def output_level_db(level: int) -> float | None:
    """An operator's output level in dB under full, or None for off.

    Args:
        level: The patch's output level, 0 to 99.

    Returns:
        0 dB at 99, 0.75 dB a step, held at -72 dB; None at 0.
    """
    if level == 0:
        return None
    return max(LEVEL_DB_MIN, (scale_output_level(level) - 127) * 0.75)


def envelope_units(level: int, output_level: int) -> int:
    """msfa's absolute envelope level for a patch level, as env.cc has it.

    Args:
        level: The envelope level, 0 to 99.
        output_level: The operator's output level, 0 to 99.

    Returns:
        The level in 1/256-octave units, never under 16.
    """
    units = ((scale_output_level(level) >> 1) << 6)
    units += (scale_output_level(output_level) << 5) - 4256
    return max(16, units)


def envelope_level_db(level: int) -> float:
    """An envelope level in dB under the operator's own level.

    Args:
        level: The envelope level, 0 to 99.

    Returns:
        0 dB at 99, about 1.5 dB a scaled step; silence at 0.
    """
    if level == 0:
        return SILENCE_DB
    steps = (scale_output_level(level) >> 1) - (scale_output_level(99) >> 1)
    return max(SILENCE_DB, steps * 64 * DB_PER_UNIT)


def rate_speed(rate: int) -> float:
    """How fast a DX7 rate moves the envelope, in dB a second.

    Args:
        rate: The patch's rate, 0 to 99.

    Returns:
        0.0633 × (4 + q mod 4) × 2^floor(q / 4), q = rate × 41 / 64.
    """
    q = min(63, rate * 41 // 64)
    return math.ldexp(0.0633 * (4 + q % 4), q // 4)


def stage_seconds(rate: int, start: int, target: int) -> float:
    """How long a stage takes, from one absolute level to another.

    A fall is a straight line at the rate's speed. A rise, as in msfa,
    first jumps to a floor and then rises faster the lower it is
    (env.cc: level += (17 - level / 256) × increment), which integrates
    to a logarithm.

    Args:
        rate: The stage's rate, 0 to 99.
        start: Where it starts, in msfa's units.
        target: Where it ends, in msfa's units.

    Returns:
        The time in seconds, held between 0 and MAX_STAGE_SECONDS.
    """
    speed = rate_speed(rate) / DB_PER_UNIT
    if target <= start:
        seconds = (start - target) / speed
    else:
        floor = max(start, JUMP_TARGET)
        if target <= floor:
            return 0.0
        seconds = 256 / speed * math.log(
            (17 - floor / 256) / (17 - target / 256)
        )
    return min(MAX_STAGE_SECONDS, seconds)


def scaling_side(depth: int, curve: int) -> dict[str, object]:
    """One side of keyboard level scaling, in clean units.

    Args:
        depth: The patch's depth, 0 to 99.
        curve: 0 -lin, 1 -exp, 2 +exp, 3 +lin.

    Returns:
        Its curve, "lin" or "exp", and its depth in dB a group of three
        keys, negative for quieter.
    """
    sign = -1 if curve < 2 else 1
    return {
        "curve": "lin" if curve in (0, 3) else "exp",
        "depth": round(sign * depth * DB_PER_DEPTH, 3),
    }


def operator_ratio(op: RawOperator) -> float:
    """An operator's frequency as a multiple of the note's.

    A fixed-frequency operator, which the sandbox cannot play, becomes
    the ratio its frequency is of middle C (right at middle C only).

    Args:
        op: The operator as the patch stores it.

    Returns:
        Coarse (0 is a half) times 1 + fine / 100; or, fixed, 10 to the
        (coarse mod 4) + fine / 100 Hz over middle C (osc_freq), held
        within the sandbox's 0.5 to 61.69.
    """
    if op.fixed:
        ratio = 10 ** ((op.coarse & 3) + op.fine / 100) / MIDDLE_C_HZ
        return min(RATIO_MAX, max(RATIO_MIN, ratio))
    return (0.5 if op.coarse == 0 else op.coarse) * (1 + op.fine / 100)


def convert_operator(op: RawOperator) -> dict[str, object]:
    """One operator in the sandbox's units (src/dsp/dx7.ts, Dx7Operator).

    Args:
        op: The operator as the patch stores it.

    Returns:
        Its ratio, detune, level and envelope, its break point, scaling
        and rate scaling.
    """
    ratio = operator_ratio(op)
    units = [envelope_units(level, op.output_level) for level in op.levels]
    start = units[3]
    envelope = {
        "attack": max(MIN_STAGE_SECONDS,
                      stage_seconds(op.rates[0], start, units[0])),
        "peak": envelope_level_db(op.levels[0]),
        "decay1": stage_seconds(op.rates[1], units[0], units[1]),
        "brk": envelope_level_db(op.levels[1]),
        "decay2": stage_seconds(op.rates[2], units[1], units[2]),
        "sustain": envelope_level_db(op.levels[2]),
        "release": min(MAX_STAGE_SECONDS,
                       -SILENCE_DB / rate_speed(op.rates[3])),
    }
    return {
        "ratio": round(ratio, 4),
        # Two places, towards zero, so a full detune stays in range.
        "detune": math.trunc((op.detune - 7) * CENTS_PER_DETUNE * 100) / 100,
        "level": output_level_db(op.output_level),
        "envelope": {k: round(v, 4 if k in TIMES else 2)
                     for k, v in envelope.items()},
        "breakKey": op.break_point + BREAK_POINT_NOTE,
        "left": scaling_side(op.left_depth, op.left_curve),
        "right": scaling_side(op.right_depth, op.right_curve),
        "rateScaling": round(2 ** (op.rate_scaling / 8), 4),
        "tremolo": AMS_SHARES[op.amp_sensitivity],
    }


def lfo_hz(speed: int) -> float:
    """The LFO's speed in Hz, as msfa's lfo.cc has it.

    Args:
        speed: The patch's LFO speed, 0 to 99.

    Returns:
        sr × 25190424 / 2^32, where sr = (165 × speed) >> 6 (1 at 0),
        times 11, or by 11 + ((sr - 160) >> 4) from 160.
    """
    sr = (165 * speed) >> 6 if speed else 1
    sr *= 11 if sr < 160 else 11 + ((sr - 160) >> 4)
    return sr * 25190424 / 2**32


def lfo_delay_seconds(delay: int) -> float:
    """How long the LFO is held back after a key, in seconds (lfo.cc).

    Args:
        delay: The patch's LFO delay, 0 to 99.

    Returns:
        0 at 0; else 2^31 / (25190424 × step), with a = 99 - delay and
        step = (16 + (a & 15)) << (1 + (a >> 4)).
    """
    if delay == 0:
        return 0.0
    a = 99 - delay
    step = (16 + (a & 15)) << (1 + (a >> 4))
    return 2**31 / (25190424 * step)


def vibrato_cents(depth: int, sensitivity: int) -> float:
    """The LFO's peak pitch swing in cents (dx7note.cc).

    Args:
        depth: The patch's PMD, 0 to 99.
        sensitivity: The patch's PMS, 0 to 7.

    Returns:
        1200 × ((PMD × 165) >> 6) × weight / 65536.
    """
    return 1200 * ((depth * 165) >> 6) * PMS_WEIGHTS[sensitivity] / 65536


def tremolo_db(depth: int) -> float:
    """How far the LFO pulls a full-level operator down, at most, in dB.

    Dexed (dx7note.cc) takes a share pt / 2^24 of an operator's level in
    its log units (15 doublings at full), with pt = exp(0.0175 ×
    ((AMD × 165) >> 6) + 12.2), at the bottom of the wave with AMS 3. The
    share at AMD 0 is taken away, so 0 is none.

    Args:
        depth: The patch's AMD, 0 to 99.

    Returns:
        About 91.7 dB at 99.
    """
    scaled = (depth * 165) >> 6

    def share(pt: float) -> float:
        return pt * 16 / 2**28

    pulled = share(math.exp(0.0175 * scaled + 12.2)) - share(math.exp(12.2))
    return 15 * 20 * math.log10(2) * pulled


def convert_lfo(voice: RawVoice) -> dict[str, object]:
    """The voice's LFO in the sandbox's units (src/dsp/dx7.ts, Dx7Lfo).

    Args:
        voice: The voice as the patch stores it.

    Returns:
        Its wave, speed in Hz, delay in seconds, vibrato in cents,
        tremolo in dB and key sync.
    """
    return {
        "wave": LFO_WAVES[min(voice.lfo_wave, len(LFO_WAVES) - 1)],
        "speed": round(lfo_hz(voice.lfo_speed), 4),
        "delay": round(lfo_delay_seconds(voice.lfo_delay), 4),
        "vibrato": round(vibrato_cents(voice.lfo_pitch_depth,
                                       voice.pitch_sensitivity), 2),
        "tremolo": round(tremolo_db(voice.lfo_amp_depth), 2),
        "sync": voice.lfo_sync,
    }


def missing(voice: RawVoice) -> list[str]:
    """What the sandbox cannot play of a voice, in words.

    Args:
        voice: The voice as the patch stores it.

    Returns:
        Each feature it uses that the conversion leaves out.
    """
    lost: list[str] = []
    checks = (
        (voice.pitch_levels != (50, 50, 50, 50), "pitch envelope"),
        (any(op.velocity > 0 for op in voice.operators), "velocity"),
        (any(op.fixed for op in voice.operators),
         "fixed frequency (played as a ratio from middle C)"),
        (any(op.levels[3] > 0 for op in voice.operators),
         "an envelope ending above silence"),
        (voice.transpose != 24, "transpose"),
    )
    lost.extend(label for used, label in checks if used)
    return lost


def convert_voice(voice: RawVoice) -> dict[str, object]:
    """A voice in the sandbox's units, with what it loses.

    Args:
        voice: The voice as the patch stores it.

    Returns:
        Its name, algorithm, feedback (radians, 2π at 7, halving each
        step down), operators, LFO and what the sandbox cannot play.
    """
    feedback = 0.0 if voice.feedback == 0 else (
        2 * math.pi / 2 ** (7 - voice.feedback)
    )
    return {
        "name": voice.name,
        "algorithm": voice.algorithm,
        # Four places, down, so full feedback stays at or under 2π.
        "dxFeedback": math.floor(feedback * 10**4) / 10**4,
        "dxOperators": [convert_operator(op) for op in voice.operators],
        "dxLfo": convert_lfo(voice),
        "missing": missing(voice),
    }


def to_typescript(voices: list[dict[str, object]]) -> str:
    """The module the sandbox imports, src/chapters/dx7Factory.ts.

    Args:
        voices: Converted voices.

    Returns:
        TypeScript source.
    """
    body = json.dumps(voices, indent=2).replace('"', "'")
    return (
        "// Generated by scripts/dx7_voices.py from Yamaha's DX7 factory\n"
        "// voices (ROM1A); do not edit by hand. Factory voices © Yamaha.\n"
        "// Numbers in the sandbox's units (src/dsp/dx7.ts).\n\n"
        "import type { Dx7Lfo, Dx7Operator } from '../dsp/dx7';\n\n"
        "/** A DX7 factory voice, and what the sandbox cannot play of it. "
        "*/\n"
        "export interface FactoryVoice {\n"
        "  name: string;\n"
        "  algorithm: number;\n"
        "  dxFeedback: number;\n"
        "  dxOperators: Dx7Operator[];\n"
        "  dxLfo: Dx7Lfo;\n"
        "  missing: string[];\n"
        "}\n\n"
        f"export const FACTORY_VOICES: FactoryVoice[] = {body};\n"
    )


def main(argv: list[str]) -> int:
    """Convert the named voices of a bank into a TypeScript module.

    Args:
        argv: The bank's path, the output path, then the voices' names
            (none for all 32, in the bank's order).

    Returns:
        0 on success, 2 for bad arguments or a voice not in the bank.
    """
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    bank_path, out_path, *names = argv
    bank = unpack_bank(Path(bank_path).read_bytes())
    voices = {v.name: v for v in bank}
    names = names or [v.name for v in bank]
    unknown = [name for name in names if name not in voices]
    if unknown:
        print(f"not in the bank: {', '.join(unknown)}", file=sys.stderr)
        return 2
    converted = [convert_voice(voices[name]) for name in names]
    Path(out_path).write_text(to_typescript(converted))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
