#!/usr/bin/env python3
import re, sys, argparse
from pathlib import Path
import pandas as pd

DATE_RE = re.compile(r"^\d{4}\.\d{2}\.\d{2}$")
KG_TO_LB = 2.2046226218
GLOBAL_TO_FEELING = {"LLP"}

def normalize_tokens(s: str) -> str:
    s = re.sub(r"\s*\+\s*", "+", s.strip())
    s = re.sub(r"\s*\*\s*", "*", s)
    s = re.sub(r"\s+", " ", s)
    return s

def read_sheet(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    df.columns = [str(c).strip() for c in df.columns]
    ex_col = df.columns[0]
    df[ex_col] = df[ex_col].astype(str).str.strip().replace({"nan": None}).ffill()
    df = df.rename(columns={ex_col: "exercise"})
    block_id = (df["exercise"] != df["exercise"].shift(1)).cumsum()
    df["__set_row"] = df.groupby(block_id).cumcount() + 1
    return df

def parse_weight(cell: str):
    if cell is None or str(cell).strip() == "":
        return None, "", ""
    txt = str(cell)
    m = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(lb?s?|po|kg?s?)\b", txt, flags=re.I)
    if not m:
        return None, txt, ""
    val = float(m.group(1))
    unit_raw = m.group(2).lower()
    unit_norm = "kg" if unit_raw.startswith("kg") else "lb"
    rest = txt[m.end():].strip()
    lbs = val * KG_TO_LB if unit_norm == "kg" else val
    return lbs, rest, unit_raw

def expand_group_settings_trailing(reps_blob: str) -> str:
    pat = re.compile(r"\((\s*\d+(?:\.\d+)?(?:\s*\+\s*\d+(?:\.\d+)?)+\s*)\)\(([^)]+)\)")
    def repl(m):
        nums = re.sub(r"\s*", "", m.group(1)).split("+")
        setting = m.group(2).strip()
        return "+".join([f"{n}({setting})" for n in nums])
    prev = None; reps_blob = reps_blob.strip()
    while prev != reps_blob:
        prev = reps_blob; reps_blob = pat.sub(repl, reps_blob)
    return reps_blob

def normalize_side_prefix_tokens(blob: str) -> str:
    """R12 -> 12R, L9HA*2 -> 9LHA*2, keeps multipliers/notes."""
    toks = [t.strip() for t in blob.split("+") if t.strip()]
    out = []
    pref = re.compile(r"^([RLrl])\s*([0-9]+(?:\.[0-9]+)?)([A-Za-z]*)(?:\*([0-9]+))?$")
    for t in toks:
        m = pref.match(t)
        if m:
            side = m.group(1).upper()
            num = m.group(2)
            suf = (m.group(3) or "").upper()
            mult = m.group(4)
            t = f"{num}{side}{suf}" + (f"*{mult}" if mult else "")
        out.append(t)
    return "+".join(out)

def split_reps_segments(rest: str):
    rest = normalize_tokens(rest)
    mr = re.match(r"^([0-9A-Za-z\.\(\)\+\* ]+?)(?:\s+|$)(.*)$", rest)
    reps_blob, tail = (mr.group(1).strip(), mr.group(2).strip()) if mr else (rest, "")
    if not re.search(r"\d", reps_blob):
        return [], [tail or reps_blob]

    reps_blob = expand_group_settings_trailing(reps_blob)

    # Leading group setting after weight: "(3) 6+3+3"
    group_setting = None
    m_lead = re.match(r"^\(([^)]+)\)\s*(.+)$", reps_blob)
    if m_lead:
        group_setting = (m_lead.group(1) or "").strip() or None
        reps_blob = m_lead.group(2).strip()

    # Side prefixes after weight: "R12+L9"
    reps_blob = normalize_side_prefix_tokens(reps_blob)

    segs, global_feelings = [], ([tail] if tail else [])
    seg_pat = re.compile(r"^(?:\(([^)]+)\))?([0-9]+(?:\.[0-9]+)?)(?:\(([^)]+)\))?([A-Za-z]*)(?:\*([0-9]+))?$")

    for raw_seg in reps_blob.split("+"):
        seg = raw_seg.strip()
        if not seg:
            continue
        m = seg_pat.match(seg)
        if not m:
            global_feelings.append(seg); continue
        set_lead = (m.group(1) or "").strip() or None
        reps_num = float(m.group(2))
        set_trail = (m.group(3) or "").strip() or None
        suffix = (m.group(4) or "").upper()
        mult = int(m.group(5)) if m.group(5) else 1
        setting = set_lead if set_lead is not None else set_trail
        if setting is None and group_setting is not None:
            setting = group_setting
        side = suffix if suffix in ("R","L") else None
        seg_note = None
        if suffix and suffix not in ("R","L"):
            if suffix in GLOBAL_TO_FEELING: global_feelings.append(suffix)
            else: seg_note = suffix
        for _ in range(mult):
            segs.append(dict(reps_raw=seg, reps=reps_num, side=side, seg_note=seg_note, setting=setting))
    return segs, global_feelings

def parse_side_weight_pairs(txt: str):
    # "L10kgs 13 R10kgs 15"
    txt_norm = normalize_tokens(txt)
    pat = re.compile(r"\b([RLrl])\s*([0-9]+(?:\.[0-9]+)?)\s*(lb?s?|po|kg?s?)\s*([0-9]+(?:\.[0-9]+)?)\b")
    parts = []; used = []
    for m in pat.finditer(txt_norm):
        side = m.group(1).upper()
        val = float(m.group(2)); unit = m.group(3).lower()
        reps = float(m.group(4))
        lbs = val * KG_TO_LB if unit.startswith("kg") else val
        parts.append(dict(weight_lbs=lbs, reps=reps, side=side, setting=None, segment_note=None,
                          reps_raw_part=f"{int(reps) if reps.is_integer() else reps}{side}",
                          weight_unit_raw=unit, feeling=None))
        used.append((m.start(), m.end()))
    leftover = txt_norm
    for s,e in reversed(used):
        leftover = leftover[:s] + leftover[e:]
    feeling = leftover.strip() or None
    return parts, feeling

def parse_entry_cell(cell):
    lbs, rest_raw, unit = parse_weight(cell)
    rest = normalize_tokens(rest_raw)

    parts_swr, leftover = parse_side_weight_pairs(rest)
    if parts_swr:
        if leftover:
            for p in parts_swr: p["feeling"] = leftover
        return parts_swr

    segs, global_feelings = split_reps_segments(rest)
    if segs:
        feeling = " | ".join([f for f in (x.strip() for x in global_feelings) if f]) or None
        return [dict(weight_lbs=lbs, reps=s["reps"], side=s["side"], setting=s["setting"],
                     segment_note=s["seg_note"], reps_raw_part=s["reps_raw"],
                     weight_unit_raw=unit, feeling=feeling) for s in segs]

    if lbs is not None:
        feeling = " | ".join([f for f in (x.strip() for x in global_feelings) if f]) or None
        return [dict(weight_lbs=lbs, reps=12.0, side=None, setting=None, segment_note=None,
                     reps_raw_part=None, weight_unit_raw=unit, feeling=feeling)]
    return []

def flatten_one(df: pd.DataFrame, src_name: str) -> pd.DataFrame:
    date_cols = [c for c in df.columns if DATE_RE.match(str(c))]
    long_df = df.melt(id_vars=["exercise","__set_row"], value_vars=date_cols,
                      var_name="date_str", value_name="entry")
    long_df = long_df[long_df["entry"].astype(str).str.strip() != ""]
    long_df["date"] = pd.to_datetime(long_df["date_str"], format="%Y.%m.%d", errors="coerce")
    long_df = long_df.dropna(subset=["date"])
    rows = []
    for _, r in long_df.iterrows():
        parts = parse_entry_cell(r["entry"])
        raw_cell = str(r["entry"])
        for idx, p in enumerate(parts, start=1):
            rows.append({
                "date": r["date"].date(),
                "exercise": r["exercise"],
                "weight_lbs": round(p["weight_lbs"], 2) if p["weight_lbs"] is not None else None,
                "reps": p["reps"],
                "side": p["side"],
                "setting": p.get("setting"),
                "segment_note": p.get("segment_note"),
                "feeling": p.get("feeling"),
                "reps_raw_part": p["reps_raw_part"],
                "raw_cell": raw_cell,
                "weight_unit_raw": p.get("weight_unit_raw", ""),
                "_set_row": r["__set_row"],
                "_part_idx": idx,
                "source_file": src_name
            })
    out = pd.DataFrame(rows)
    if out.empty: 
        return out
    out = out.sort_values(["exercise","date","_set_row","_part_idx"]).reset_index(drop=True)
    out["set_number"] = out.groupby(["date","exercise"]).cumcount() + 1
    return out

def flatten_many(paths, out_prefix: Path):
    all_parts = []
    for p in paths:
        df = read_sheet(p)
        all_parts.append(flatten_one(df, p.name))
    out = pd.concat(all_parts, ignore_index=True) if all_parts else pd.DataFrame()
    if out.empty:
        (out_prefix.with_name(out_prefix.name + "_full.csv")).write_text("")
        (out_prefix.with_name(out_prefix.name + "_clean.csv")).write_text("")
        return
    out = out.sort_values(["date","exercise","set_number","source_file"]).reset_index(drop=True)
    full_cols = ["date","exercise","set_number","weight_lbs","reps","side","setting","segment_note",
                 "feeling","reps_raw_part","raw_cell","weight_unit_raw","_set_row","_part_idx","source_file"]
    clean_cols = ["date","exercise","set_number","weight_lbs","reps","side","setting","segment_note",
                  "feeling","reps_raw_part","raw_cell","source_file"]
    out[full_cols].to_csv(out_prefix.with_name(out_prefix.name + "_full.csv"), index=False)
    out[clean_cols].to_csv(out_prefix.with_name(out_prefix.name + "_clean.csv"), index=False)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("raw_csvs", nargs="+", help="Paths to raw workout CSVs")
    ap.add_argument("--out-prefix", type=str, default=None, help="Output prefix (default: 'workouts_flattened')")
    args = ap.parse_args()
    paths = [Path(p).expanduser().resolve() for p in args.raw_csvs]
    for p in paths:
        if not p.exists():
            print(f"Not found: {p}", file=sys.stderr); sys.exit(1)
    out_prefix = Path(args.out_prefix).expanduser().resolve() if args.out_prefix else Path.cwd() / "workouts_flattened"
    flatten_many(paths, out_prefix)

if __name__ == "__main__":
    main()

