#!/usr/bin/env python3
"""Compare the exported six-week example against the user's independent transcription.

Run from repository root: python3 docs/release/ko-KR/compare-phat-reference.py
The compact week values are source transcription, not copied from implementation tests.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PROGRAM = ROOT / "examples/phat-6week-kr.json"

# day, original source label, canonical/example label, rest seconds, set-type pattern,
# then W1..W6 as weight x reps; slash separates TOP/BACKOFF pairs.
REFERENCE = [
 (1,"Bench Press Barbell","Bench Press, Barbell",180,"TB","90x4/80x8;90x5/80x9;92.5x4/82.5x8;92.5x5/82.5x9;95x4/85x8;95x5/85x9"),
 (1,"Bent Over Row Barbell","Bent Over Row, Barbell",180,"TB","60x5/50x8;60x6/50x9;65x5/55x8;65x6/55x9;70x5/60x8;70x6/60x9"),
 (1,"Overhead Press Barbell","Overhead Press, Barbell",150,"S4","37.5x6;37.5x7;40x6;40x7;42.5x5;42.5x6"),
 (1,"Lat Pulldown Cable","Lat Pulldown, Cable",120,"S3","56x6;56x8;63x6;63x7;63x8;70x6"),
 (1,"Bicep Curl Barbell","Bicep Curl, Barbell",90,"S3","30x8;30x9;30x10;32.5x8;32.5x9;35x8"),
 (1,"Skullcrusher EZ Bar","Skullcrusher, EZ Bar",90,"S3","30x8;30x9;30x10;32.5x8;32.5x9;35x8"),
 (2,"Squat Barbell","Squat, Barbell",210,"TB","100x4/85x8;100x5/85x9;105x4/90x8;105x5/90x9;110x4/95x8;110x5/95x9"),
 (2,"Romanian Deadlift Barbell","Romanian Deadlift, Barbell",150,"S4","80x6;80x8;85x6;85x8;90x6;90x8"),
 (2,"Leg Press Leverage Machine","Leg Press, Leverage Machine",120,"S3","160x8;160x10;180x8;180x10;200x8;200x10"),
 (2,"Lying Leg Curl Leverage Machine","Lying Leg Curl, Leverage Machine",90,"S3","40x10;40x12;45x10;45x12;50x10;50x12"),
 (2,"Standing Calf Raise Leverage Machine","Standing Calf Raise, Leverage Machine",90,"S4","60x12;60x15;70x12;70x15;80x12;80x15"),
 (3,"Lat Pulldown Cable","Lat Pulldown, Cable",120,"S4","48.9x10;48.9x11;48.9x12;56x8;56x9;56x10"),
 (3,"Seated Row Cable","Seated Row, Cable",120,"S4","48.9x10;48.9x11;48.9x12;56x8;56x9;56x10"),
 (3,"Straight Arm Pulldown Cable","케이블 암 풀다운, Cable",90,"S2","23.75x15;26.25x12;26.25x15;28.75x12;28.75x14;28.75x15"),
 (3,"Rear Delt Reverse Fly Leverage Machine","Reverse Fly, Leverage Machine",90,"S4","30x12;30x15;35x12;35x15;40x12;40x15"),
 (3,"Incline Curl Dumbbell","Incline Curl, Dumbbell",90,"S3","12x10;12x12;14x10;14x11;14x12;16x10"),
 (3,"Hammer Curl Dumbbell","Hammer Curl, Dumbbell",90,"S3","12x12;14x10;14x12;16x10;16x11;16x12"),
 (4,"Incline Bench Press Dumbbell","Incline Bench Press, Dumbbell",120,"S4","26x10;28x8;28x10;30x8;30x10;32x8"),
 (4,"Chest Dip Bodyweight","Chest Dip, Bodyweight",120,"S4","0x8;0x9;0x10;0x12;4x8;4x10"),
 (4,"Chest Fly Leverage Machine","Chest Fly, Leverage Machine",90,"S3","40x12;45x10;45x12;50x10;50x11;50x12"),
 (4,"Lateral Raise Dumbbell","Lateral Raise, Dumbbell",90,"S4","10x15;10x18;10x20;12x12;12x14;12x15"),
 (4,"Triceps Pushdown Cable","Triceps Pushdown, Cable",90,"S3","21.25x12;21.25x15;23.75x12;23.75x15;26.25x12;26.25x15"),
 (4,"Triceps Extension Cable","Triceps Extension, Cable",90,"S3","21.25x12;21.25x15;26.25x12;26.25x15;28.75x12;28.75x15"),
 (5,"Hack Squat Leverage Machine","Hack Squat, Leverage Machine",150,"S4","80x10;80x12;90x10;90x12;100x10;100x12"),
 (5,"Bulgarian Split Squat Dumbbell","Bulgarian Split Squat, Dumbbell",120,"S3","12x10;12x12;16x10;16x12;20x10;20x12"),
 (5,"Leg Extension Leverage Machine","Leg Extension, Leverage Machine",90,"S3","45x12;45x15;50x12;50x15;55x12;55x15"),
 (5,"Seated Leg Curl Leverage Machine","Seated Leg Curl, Leverage Machine",90,"S4","40x12;40x15;45x12;45x15;50x12;50x15"),
 (5,"Seated Calf Raise Leverage Machine","Seated Calf Raise, Leverage Machine",60,"S3","40x15;40x18;45x15;45x18;50x15;50x18"),
 (5,"Hanging Leg Raise Bodyweight","Hanging Leg Raise, Bodyweight",60,"S3","0x15;0x15;0x18;0x18;0x20;0x20"),
]

def pair(token):
    weight, reps = token.split("x")
    return float(weight), int(reps)

def main():
    actual = json.loads(PROGRAM.read_text(encoding="utf-8"))
    errors = []
    if actual.get("duration_weeks") != 6 or actual.get("days_per_week") != 5:
        errors.append("program dimensions differ from 6 weeks x 5 days")
    workouts = actual.get("workouts", [])
    if len(workouts) != 5:
        errors.append(f"workout count: expected 5, got {len(workouts)}")
    expected_by_day = {d: [] for d in range(1, 6)}
    for row in REFERENCE:
        expected_by_day[row[0]].append(row)
    row_count = set_count = 0
    for day in range(1, 6):
        workout = next((w for w in workouts if w.get("day_index") == day), None)
        if workout is None:
            errors.append(f"D{day}: missing workout")
            continue
        exercises = workout.get("exercises", [])
        expected_rows = expected_by_day[day]
        if len(exercises) != len(expected_rows):
            errors.append(f"D{day}: exercise count expected {len(expected_rows)}, got {len(exercises)}")
        for order, row in enumerate(expected_rows, 1):
            _, source_name, actual_name, rest, pattern, weeks = row
            row_count += 6
            ex = next((e for e in exercises if e.get("order") == order), None)
            label = f"D{day}.{order} {source_name}"
            if ex is None:
                errors.append(f"{label}: missing exercise order")
                continue
            if ex.get("name") != actual_name:
                errors.append(f"{label}: name expected {actual_name!r}, got {ex.get('name')!r}")
            if ex.get("rest_seconds") != rest:
                errors.append(f"{label}: rest expected {rest}, got {ex.get('rest_seconds')}")
            progression = ex.get("weekly_progression", [])
            if [w.get("week") for w in progression] != list(range(1, 7)):
                errors.append(f"{label}: expected weeks 1..6")
            week_values = weeks.split(";")
            if len(week_values) != 6:
                errors.append(f"{label}: malformed reference week count")
                continue
            for week_no, (w, encoded) in enumerate(zip(progression, week_values), 1):
                expected_pairs = [pair(x) for x in encoded.split("/")]
                if pattern == "TB":
                    expected_sets = [(*expected_pairs[0], "TOP")] * 2 + [(*expected_pairs[1], "BACKOFF")] * 3
                else:
                    expected_sets = [(*expected_pairs[0], "STRAIGHT")] * int(pattern[1:])
                sets = w.get("sets", [])
                set_count += len(expected_sets)
                if len(sets) != len(expected_sets):
                    errors.append(f"{label} W{week_no}: sets expected {len(expected_sets)}, got {len(sets)}")
                for index, (weight, reps, kind) in enumerate(expected_sets, 1):
                    s = next((s for s in sets if s.get("set_no") == index), None)
                    if s is None:
                        errors.append(f"{label} W{week_no} set {index}: missing")
                        continue
                    for key, expected in (("target_weight", weight), ("target_reps", reps), ("type", kind)):
                        if s.get(key) != expected:
                            errors.append(f"{label} W{week_no} set {index}: {key} expected {expected}, got {s.get(key)}")
                    if s.get("set_no") != index:
                        errors.append(f"{label} W{week_no}: non-sequential set_no at {index}")
    if row_count != 174:
        errors.append(f"reference row count expected 174, got {row_count}")
    if set_count != 618:
        errors.append(f"reference set count expected 618, got {set_count}")
    if errors:
        print(f"FAIL: {len(errors)} mismatch(es), checked {row_count} rows / {set_count} expected sets")
        print("\n".join(errors))
        raise SystemExit(1)
    print("PASS: 174 exercise-week rows and 618 sets match the independent transcription.")
    print("Compared day/order, canonicalized name, weeks, rest, set count/order/type, target weight and reps.")

if __name__ == "__main__":
    main()
