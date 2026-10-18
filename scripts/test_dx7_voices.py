#!/usr/bin/env python3
"""Tests for dx7_voices.py, against values worked out by hand."""

import math

import pytest

from dx7_voices import (
    BANK_BYTES,
    HEADER,
    RawOperator,
    convert_operator,
    envelope_level_db,
    output_level_db,
    rate_speed,
    scaling_side,
    stage_seconds,
    unpack_bank,
    unpack_operator,
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
    data = bytes([1, 2, 3, 4, 5, 6, 7, 8, 39, 10, 20,
                  (2 << 2) | 1, (9 << 3) | 3, 0, 80, 14 << 1, 50])
    # Act
    op = unpack_operator(data)
    # Assert
    assert op.rates == (1, 2, 3, 4)
    assert op.levels == (5, 6, 7, 8)
    assert (op.left_curve, op.right_curve) == (1, 2)
    assert (op.rate_scaling, op.detune) == (3, 9)
    assert (op.coarse, op.fine, op.fixed) == (14, 50, False)


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
