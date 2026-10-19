#!/usr/bin/env python3
"""Tests for dx7_voices.py, against values worked out by hand."""

import math

import pytest

from dx7_voices import (
    BANK_BYTES,
    HEADER,
    VOICE_BYTES,
    RawOperator,
    convert_lfo,
    convert_operator,
    convert_pitch_envelope,
    envelope_level_db,
    lfo_delay_seconds,
    lfo_hz,
    missing,
    output_level_db,
    pitch_cents,
    pitch_speed,
    rate_speed,
    scaling_side,
    stage_seconds,
    tremolo_db,
    unpack_bank,
    unpack_operator,
    unpack_voice,
    vibrato_cents,
)


def operator(**changes: object) -> RawOperator:
    """An operator at full level, held, with `changes`."""
    base: dict[str, object] = {
        "rates": (99, 99, 99, 99),
        "levels": (99, 99, 99, 0),
        "break_point": 39,
        "left_depth": 0,
        "right_depth": 0,
        "left_curve": 0,
        "right_curve": 0,
        "rate_scaling": 0,
        "detune": 7,
        "amp_sensitivity": 0,
        "velocity": 0,
        "output_level": 99,
        "fixed": False,
        "coarse": 1,
        "fine": 0,
    }
    base.update(changes)
    return RawOperator(**base)  # type: ignore[arg-type]


def test_unpacks_an_operators_packed_bytes() -> None:
    # Arrange: rates 1-4, levels 5-8, break point 39, depths 10 and 20,
    # curves 1 (left) and 2 (right), rate scaling 3 and detune 9, output
    # level 80, coarse 14 and fine 50.
    # AMS 2 and velocity sensitivity 5 share byte 13.
    data = bytes([1, 2, 3, 4, 5, 6, 7, 8, 39, 10, 20,
                  (2 << 2) | 1, (9 << 3) | 3, (5 << 2) | 2, 80, 14 << 1,
                  50])
    # Act
    op = unpack_operator(data)
    # Assert
    assert op.rates == (1, 2, 3, 4)
    assert op.levels == (5, 6, 7, 8)
    assert (op.left_curve, op.right_curve) == (1, 2)
    assert (op.rate_scaling, op.detune) == (3, 9)
    assert (op.coarse, op.fine, op.fixed) == (14, 50, False)
    assert (op.amp_sensitivity, op.velocity) == (2, 5)


def lfo_voice(speed: int, delay: int, pmd: int, amd: int,
              byte116: int) -> bytes:
    """A packed voice, all zero but its LFO bytes, 112 to 116."""
    data = bytearray(VOICE_BYTES)
    data[112:117] = bytes([speed, delay, pmd, amd, byte116])
    data[117] = 24
    data[118:128] = b"LFO TEST  "
    return bytes(data)


def test_unpacks_the_lfo_from_bytes_112_to_116() -> None:
    # Speed 35, delay 50, PMD 20, AMD 30; sync on, sine (4), PMS 3.
    voice = unpack_voice(lfo_voice(35, 50, 20, 30, (3 << 4) | (4 << 1) | 1))
    assert (voice.lfo_speed, voice.lfo_delay) == (35, 50)
    assert (voice.lfo_pitch_depth, voice.lfo_amp_depth) == (20, 30)
    assert (voice.lfo_sync, voice.lfo_wave, voice.pitch_sensitivity) == (
        True, 4, 3)


def test_lfo_speeds_at_the_dx7s_steps() -> None:
    # msfa's lfo.cc: 0.065 Hz to 23.9 Hz.
    for step, hz in ((0, 0.065), (1, 0.13), (10, 1.6), (35, 5.8),
                     (50, 8.3), (70, 12.7), (99, 23.9)):
        assert lfo_hz(step) == pytest.approx(hz, abs=0.05)


def test_lfo_delays_at_the_dx7s_steps() -> None:
    assert lfo_delay_seconds(0) == 0
    for step, seconds in ((30, 0.13), (50, 0.31), (70, 0.74), (99, 2.66)):
        assert lfo_delay_seconds(step) == pytest.approx(seconds, abs=0.01)


def test_vibrato_in_cents_from_pmd_and_pms() -> None:
    assert vibrato_cents(0, 7) == 0
    assert vibrato_cents(99, 0) == 0
    # 255 × 255 / 65536 of an octave: about 1190 cents.
    assert vibrato_cents(99, 7) == pytest.approx(1190.6, abs=0.1)
    # PMD 99 and PMS 1: 255 × 10 / 65536 octave, 46.7 cents.
    assert vibrato_cents(99, 1) == pytest.approx(46.7, abs=0.1)


def test_tremolo_in_db_from_amd() -> None:
    assert tremolo_db(0) == 0
    assert tremolo_db(99) == pytest.approx(91.7, abs=0.1)
    # It grows faster and faster: half the depth is far under half the dB.
    assert tremolo_db(50) < tremolo_db(99) / 5


def test_converts_a_voices_lfo() -> None:
    voice = unpack_voice(lfo_voice(35, 50, 99, 0, (1 << 4) | (2 << 1)))
    lfo = convert_lfo(voice)
    assert lfo["wave"] == "sawUp"
    assert lfo["sync"] is False
    assert lfo["speed"] == pytest.approx(5.8, abs=0.05)
    assert lfo["delay"] == pytest.approx(0.31, abs=0.01)
    assert lfo["vibrato"] == pytest.approx(46.7, abs=0.1)
    assert lfo["tremolo"] == 0


def test_an_lfo_is_no_longer_missing() -> None:
    voice = unpack_voice(lfo_voice(35, 0, 99, 99, (7 << 4)))
    assert "vibrato" not in missing(voice)
    assert "tremolo" not in missing(voice)


def test_an_operators_tremolo_share_from_its_ams() -> None:
    shares = [convert_operator(operator(amp_sensitivity=ams))["tremolo"]
              for ams in range(4)]
    assert shares[0] == 0
    assert shares[1] == pytest.approx(66 / 255, abs=0.001)
    assert shares[2] == pytest.approx(109 / 255, abs=0.001)
    assert shares[3] == 1


def test_refuses_what_is_not_a_bank() -> None:
    with pytest.raises(ValueError):
        unpack_bank(bytes(10))
    with pytest.raises(ValueError):
        unpack_bank(bytes(BANK_BYTES))
    assert len(unpack_bank(HEADER + bytes(BANK_BYTES - len(HEADER)))) == 32


def test_output_levels_in_db() -> None:
    # 99 is full; each step 0.75 dB; 50 is 28 + 50 = 78 of 127.
    assert output_level_db(99) == 0
    assert output_level_db(50) == pytest.approx((78 - 127) * 0.75)
    assert output_level_db(1) == -72
    assert output_level_db(0) is None


def test_envelope_levels_in_db() -> None:
    # (127 >> 1) = 63 at 99; at 70, (98 >> 1) = 49: 14 half-steps of
    # 64 units, each unit 1/256 octave.
    assert envelope_level_db(99) == 0
    expected = -14 * 64 * 20 * math.log10(2) / 256
    assert envelope_level_db(70) == pytest.approx(expected)
    assert envelope_level_db(0) == -96


def test_rates_as_msfa_speeds() -> None:
    assert rate_speed(99) == pytest.approx(14519, rel=1e-3)
    assert rate_speed(50) == pytest.approx(64.8, rel=1e-3)
    assert rate_speed(25) == pytest.approx(4.05, rel=1e-3)


def test_a_fall_takes_its_distance_over_its_speed() -> None:
    # 24 dB at rate 50's 64.8 dB a second.
    units = 24 / (20 * math.log10(2) / 256)
    assert stage_seconds(50, 3000, round(3000 - units)) == pytest.approx(
        24 / 64.8, rel=1e-2)


def test_a_rise_jumps_to_the_floor_and_rises_faster_low_down() -> None:
    assert stage_seconds(50, 0, 1000) == 0
    rise = stage_seconds(50, 0, 3800)
    fall = stage_seconds(50, 3800, 1716)
    assert 0 < rise < fall


def test_converts_an_operators_ratio_detune_and_scaling() -> None:
    op = convert_operator(operator(coarse=14, fine=50, detune=10,
                                   rate_scaling=4))
    assert op["ratio"] == 21
    # Three steps of 12606 / 2^24 octave, 2.705 cents, kept to two places
    # towards zero.
    assert op["detune"] == 2.7
    assert op["rateScaling"] == pytest.approx(2 ** 0.5, abs=1e-4)
    assert op["breakKey"] == 60
    assert convert_operator(operator(coarse=0))["ratio"] == 0.5


def test_scaling_sides_by_curve() -> None:
    # Depth 99 on the linear curve: 99 × 329 / 4096 × 0.75 dB per group.
    full = 99 * 329 / 4096 * 0.75
    assert scaling_side(99, 0) == {"curve": "lin",
                                   "depth": round(-full, 3)}
    assert scaling_side(99, 2) == {"curve": "exp", "depth": round(full, 3)}


def test_makes_a_fixed_frequency_a_ratio_of_middle_c() -> None:
    # Coarse 2, fine 51: 10^2.51 Hz, about 323.6 Hz.
    op = convert_operator(operator(fixed=True, coarse=2, fine=51))
    assert op["ratio"] == pytest.approx(10**2.51 / 261.6256, abs=1e-3)


def test_holds_a_fixed_frequency_within_the_sandboxs_ratios() -> None:
    # 1 Hz (coarse 0, fine 0) is far under half of middle C.
    assert convert_operator(operator(fixed=True, coarse=0))["ratio"] == 0.5


def test_unpacks_the_pitch_envelope_from_bytes_102_to_109() -> None:
    data = bytearray(lfo_voice(35, 0, 0, 0, 0))
    data[102:110] = bytes([99, 70, 50, 40, 62, 50, 50, 38])
    voice = unpack_voice(bytes(data))
    assert voice.pitch_rates == (99, 70, 50, 40)
    assert voice.pitch_levels == (62, 50, 50, 38)


def test_pitch_levels_in_cents() -> None:
    assert pitch_cents(50) == 0
    assert pitch_cents(0) == -4800
    # Level 62 is 12 / 32 of an octave up: 450 cents.
    assert pitch_cents(62) == 450
    assert pitch_cents(99) == pytest.approx(127 / 32 * 1200)


def test_pitch_rates_in_octaves_a_second() -> None:
    assert pitch_speed(99) == pytest.approx(255 / 21.3)
    assert pitch_speed(0) == pytest.approx(1 / 21.3)


def test_a_known_pitch_speed() -> None:
    # Rate 50: pitchenv_rate[50] = 41, 41 / 21.3 octaves a second, about
    # 23.1 semitones a second.
    assert pitch_speed(50) * 12 == pytest.approx(23.1, abs=0.05)


def test_converts_a_voices_pitch_envelope() -> None:
    # TAKE OFF's: rates 32, 30, 94, 16; levels 50, 7, 81, 99.
    data = bytearray(lfo_voice(35, 0, 0, 0, 0))
    data[102:110] = bytes([32, 30, 94, 16, 50, 7, 81, 99])
    env = convert_pitch_envelope(unpack_voice(bytes(data)))
    assert env["start"] == pytest.approx(4762.5)
    assert env["peak"] == 0
    assert env["brk"] == pytest.approx(-2287.5)
    assert env["sustain"] == pytest.approx(1162.5)
    # Rate 32: pitchenv_rate[32] = 19, 19 / 21.3 octaves a second.
    assert env["attack"] == pytest.approx(19 / 21.3 * 1200, abs=0.01)
    assert "pitch envelope" not in missing(unpack_voice(bytes(data)))


@pytest.mark.parametrize(("rates", "levels", "semitones"), [
    # ROM1A's voices that bend, start / peak / break / sustain.
    ((85, 99, 75, 0), (49, 50, 50, 50), (0, -0.38, 0, 0)),          # KOTO
    ((99, 98, 75, 60), (50, 51, 50, 50), (0, 0, 0.38, 0)),          # TIMPANI
    ((38, 67, 95, 60), (39, 50, 50, 50), (0, -4.12, 0, 0)),         # REFS WHISL
    ((18, 60, 95, 60), (48, 51, 50, 50), (0, -0.75, 0.38, 0)),      # VOICE 1
    ((32, 30, 94, 16), (50, 7, 81, 99), (47.62, 0, -22.88, 11.62)),  # TAKE OFF
])
def test_the_factory_voices_pitch_envelopes(
    rates: tuple[int, int, int, int],
    levels: tuple[int, int, int, int],
    semitones: tuple[float, float, float, float],
) -> None:
    data = bytearray(lfo_voice(35, 0, 0, 0, 0))
    data[102:110] = bytes([*rates, *levels])
    env = convert_pitch_envelope(unpack_voice(bytes(data)))
    got = [env[key] / 100 for key in ("start", "peak", "brk", "sustain")]
    assert got == pytest.approx(semitones, abs=0.01)
