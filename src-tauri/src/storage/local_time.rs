//! DST-safe local-time boundaries for usage aggregation.
//!
//! Local hours and days are not fixed-length: a DST fall-back repeats an hour
//! (a 25-hour day), spring-forward skips one (23 hours), and some zones (e.g.
//! America/Santiago) skip local midnight entirely. `chrono`'s
//! `with_ymd_and_hms(..).unwrap()` panics on ambiguous times, so these helpers
//! never unwrap a `LocalResult`.
//!
//! Everything is generic over [`TimeZone`] so tests can use real DST zones.

use chrono::{DateTime, Duration, LocalResult, NaiveDate, Offset, TimeZone, Utc};

fn utc(ts: i64) -> DateTime<Utc> {
    DateTime::from_timestamp(ts, 0).unwrap_or(DateTime::UNIX_EPOCH)
}

/// UTC offset in seconds in effect at instant `ts`.
fn offset_at<Tz: TimeZone>(tz: &Tz, ts: i64) -> i64 {
    tz.offset_from_utc_datetime(&utc(ts).naive_utc())
        .fix()
        .local_minus_utc() as i64
}

/// Start of the local clock hour containing `ts`. Correct for half-hour
/// offsets (e.g. India, UTC+5:30) and across DST changes.
pub fn hour_start<Tz: TimeZone>(tz: &Tz, ts: i64) -> i64 {
    let offset = offset_at(tz, ts);
    let local = ts + offset;
    local - local.rem_euclid(3600) - offset
}

/// Start of the local hour after the one containing `ts`.
pub fn next_hour_start<Tz: TimeZone>(tz: &Tz, ts: i64) -> i64 {
    let current = hour_start(tz, ts);
    let next = hour_start(tz, current + 3600);
    if next > current { next } else { current + 3600 }
}

/// Local calendar date at instant `ts`.
pub fn local_date<Tz: TimeZone>(tz: &Tz, ts: i64) -> NaiveDate {
    tz.from_utc_datetime(&utc(ts).naive_utc()).date_naive()
}

/// First instant of `date` in local time. If local midnight does not exist
/// (DST gap at 00:00), this is the first local time after the gap.
pub fn day_start<Tz: TimeZone>(tz: &Tz, date: NaiveDate) -> i64 {
    let midnight = date.and_hms_opt(0, 0, 0).unwrap_or_default();
    for step in 0..=8 {
        let candidate = midnight + Duration::minutes(30 * step);
        match tz.from_local_datetime(&candidate) {
            LocalResult::Single(t) => return t.timestamp(),
            LocalResult::Ambiguous(earliest, _) => return earliest.timestamp(),
            LocalResult::None => continue,
        }
    }
    // No real zone has a gap longer than a few hours; fall back to UTC.
    midnight.and_utc().timestamp()
}

/// `[start, end)` of a local calendar day, in Unix seconds.
pub fn day_bounds<Tz: TimeZone>(tz: &Tz, date: NaiveDate) -> (i64, i64) {
    let start = day_start(tz, date);
    let end = date
        .succ_opt()
        .map(|next| day_start(tz, next))
        .unwrap_or(start + 86_400);
    (start, end)
}

pub fn day_key(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

pub fn month_key(date: NaiveDate) -> String {
    date.format("%Y-%m").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono_tz::America::{New_York, Santiago};
    use chrono_tz::Asia::Kolkata;
    use chrono_tz::Europe::Berlin;

    fn ts<Tz: TimeZone>(tz: &Tz, y: i32, m: u32, d: u32, h: u32, min: u32) -> i64 {
        tz.with_ymd_and_hms(y, m, d, h, min, 0)
            .earliest()
            .expect("valid local time")
            .timestamp()
    }

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    #[test]
    fn hour_start_in_half_hour_offset_zone() {
        // 10:47 IST → 10:00 IST, which is 04:30 UTC (not 04:00).
        let t = ts(&Kolkata, 2026, 3, 10, 10, 47);
        assert_eq!(hour_start(&Kolkata, t), ts(&Kolkata, 2026, 3, 10, 10, 0));
        assert_eq!(hour_start(&Kolkata, t) % 3600, 1800);
    }

    #[test]
    fn hour_start_during_repeated_fall_back_hour_does_not_panic() {
        // Berlin 2026-10-25: 02:00-03:00 happens twice.
        let first = ts(&Berlin, 2026, 10, 25, 2, 30);
        let second = first + 3600;
        assert_eq!(hour_start(&Berlin, first), first - 1800);
        assert_eq!(hour_start(&Berlin, second), second - 1800);
        assert_eq!(next_hour_start(&Berlin, first), second - 1800);
    }

    #[test]
    fn fall_back_day_is_25_hours() {
        let (start, end) = day_bounds(&Berlin, date(2026, 10, 25));
        assert_eq!(end - start, 25 * 3600);
    }

    #[test]
    fn spring_forward_day_is_23_hours() {
        let (start, end) = day_bounds(&New_York, date(2026, 3, 8));
        assert_eq!(end - start, 23 * 3600);
    }

    #[test]
    fn missing_local_midnight_starts_day_after_gap() {
        // Santiago 2026-09-06: clocks jump from 00:00 to 01:00.
        let start = day_start(&Santiago, date(2026, 9, 6));
        assert_eq!(start, ts(&Santiago, 2026, 9, 6, 1, 0));
        let (_, prev_end) = day_bounds(&Santiago, date(2026, 9, 5));
        assert_eq!(prev_end, start);
    }

    #[test]
    fn hours_tile_a_dst_day_exactly() {
        let (start, end) = day_bounds(&Berlin, date(2026, 10, 25));
        let mut h = start;
        let mut count = 0;
        while h < end {
            h = next_hour_start(&Berlin, h);
            count += 1;
        }
        assert_eq!(h, end);
        assert_eq!(count, 25);
    }

    #[test]
    fn local_date_and_keys() {
        let t = ts(&Kolkata, 2026, 1, 31, 23, 59);
        assert_eq!(local_date(&Kolkata, t), date(2026, 1, 31));
        assert_eq!(day_key(date(2026, 1, 5)), "2026-01-05");
        assert_eq!(month_key(date(2026, 1, 5)), "2026-01");
    }
}
