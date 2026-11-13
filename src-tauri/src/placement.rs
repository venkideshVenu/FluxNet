//! Pure geometry for placing widget windows across multiple monitors.
//!
//! Kept free of Tauri types so it can be unit-tested with synthetic monitor
//! layouts (mixed DPI, monitors left of / above the primary, unplugged
//! displays). All coordinates are physical pixels in the virtual desktop.

/// A monitor's work area (screen minus taskbar) and its DPI scale.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Display {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
}

impl Display {
    fn right(&self) -> i32 {
        self.x.saturating_add(self.width as i32)
    }

    fn bottom(&self) -> i32 {
        self.y.saturating_add(self.height as i32)
    }

    fn contains(&self, x: i32, y: i32) -> bool {
        x >= self.x && x < self.right() && y >= self.y && y < self.bottom()
    }

    /// Squared distance from a point to the nearest point of this rectangle.
    fn distance_sq(&self, x: i32, y: i32) -> i64 {
        let dx = (self.x - x).max(0).max(x - (self.right() - 1)) as i64;
        let dy = (self.y - y).max(0).max(y - (self.bottom() - 1)) as i64;
        dx * dx + dy * dy
    }
}

/// Gap kept between a default-placed widget and the work-area edge (logical px).
pub const EDGE_MARGIN: f64 = 24.0;

/// Picks the display a saved top-left position belongs to: the one that
/// contains it, else the nearest one (the monitor it was on may be unplugged),
/// else the primary.
pub fn display_for_point(displays: &[Display], primary: usize, x: i32, y: i32) -> Option<Display> {
    if let Some(d) = displays.iter().find(|d| d.contains(x, y)) {
        return Some(*d);
    }
    displays
        .iter()
        .min_by_key(|d| d.distance_sq(x, y))
        .copied()
        .or_else(|| displays.get(primary).copied())
}

/// Physical size of a window with the given logical size on `display`.
pub fn physical_size(display: &Display, logical_w: f64, logical_h: f64) -> (u32, u32) {
    let scale = if display.scale.is_finite() && display.scale > 0.0 {
        display.scale
    } else {
        1.0
    };
    (
        (logical_w * scale).round() as u32,
        (logical_h * scale).round() as u32,
    )
}

/// Moves a window so it lies fully inside `display` where possible. If the
/// window is larger than the work area it is pinned to the top-left.
pub fn clamp_to_display(display: &Display, x: i32, y: i32, w: u32, h: u32) -> (i32, i32) {
    let max_x = (display.right() - w as i32).max(display.x);
    let max_y = (display.bottom() - h as i32).max(display.y);
    (x.clamp(display.x, max_x), y.clamp(display.y, max_y))
}

/// Where to restore a widget whose last top-left position was `(x, y)`.
pub fn restore_position(
    displays: &[Display],
    primary: usize,
    x: i32,
    y: i32,
    logical_w: f64,
    logical_h: f64,
) -> Option<(i32, i32)> {
    let display = display_for_point(displays, primary, x, y)?;
    let (w, h) = physical_size(&display, logical_w, logical_h);
    Some(clamp_to_display(&display, x, y, w, h))
}

/// First-run position: stacked down the right edge of the primary display,
/// so it works on any resolution instead of assuming a 1920px-wide screen.
pub fn default_position(
    displays: &[Display],
    primary: usize,
    slot: usize,
    logical_w: f64,
    logical_h: f64,
) -> Option<(i32, i32)> {
    let display = displays.get(primary).or_else(|| displays.first())?;
    let (w, h) = physical_size(display, logical_w, logical_h);
    let margin = (EDGE_MARGIN * display.scale.max(1.0)).round() as i32;
    // 180 logical px per slot fits the tallest widget (compact, 172px).
    let step = (180.0 * display.scale.max(1.0)).round() as i32;
    let x = display.right() - w as i32 - margin;
    let y = display.y + margin + step * slot as i32;
    Some(clamp_to_display(display, x, y, w, h))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(x: i32, y: i32, width: u32, height: u32, scale: f64) -> Display {
        Display {
            x,
            y,
            width,
            height,
            scale,
        }
    }

    /// 1080p primary at 100% plus a 4K monitor at 150% to its right.
    fn dual() -> Vec<Display> {
        vec![d(0, 0, 1920, 1040, 1.0), d(1920, 0, 3840, 2100, 1.5)]
    }

    #[test]
    fn keeps_position_on_secondary_monitor() {
        // Regression: this used to be clamped into the primary monitor.
        let pos = restore_position(&dual(), 0, 3000, 500, 232.0, 32.0);
        assert_eq!(pos, Some((3000, 500)));
    }

    #[test]
    fn clamps_using_the_target_monitors_scale() {
        // On the 150% monitor the pill is 348x48 physical, so the furthest
        // right it can start is 5760 - 348.
        let pos = restore_position(&dual(), 0, 5750, 500, 232.0, 32.0);
        assert_eq!(pos, Some((5760 - 348, 500)));
    }

    #[test]
    fn monitor_left_of_primary_with_negative_coordinates() {
        let displays = vec![d(0, 0, 1920, 1040, 1.0), d(-2560, -200, 2560, 1400, 1.25)];
        let pos = restore_position(&displays, 0, -1000, -100, 189.0, 172.0);
        assert_eq!(pos, Some((-1000, -100)));
    }

    #[test]
    fn unplugged_monitor_moves_widget_to_nearest_display() {
        // Saved on a monitor to the right that is no longer connected.
        let displays = vec![d(0, 0, 1920, 1040, 1.0)];
        let pos = restore_position(&displays, 0, 3000, 500, 232.0, 32.0);
        assert_eq!(pos, Some((1920 - 232, 500)));
    }

    #[test]
    fn nearest_display_wins_over_primary() {
        let displays = vec![d(0, 0, 1920, 1040, 1.0), d(1920, 0, 1920, 1040, 1.0)];
        // Below the second monitor's bottom edge.
        let pos = restore_position(&displays, 0, 2500, 5000, 232.0, 32.0);
        assert_eq!(pos, Some((2500, 1040 - 32)));
    }

    #[test]
    fn window_larger_than_display_pins_top_left() {
        let displays = vec![d(100, 50, 200, 100, 1.0)];
        assert_eq!(
            clamp_to_display(&displays[0], 500, 500, 400, 300),
            (100, 50)
        );
    }

    #[test]
    fn no_displays_returns_none() {
        assert_eq!(restore_position(&[], 0, 10, 10, 10.0, 10.0), None);
        assert_eq!(default_position(&[], 0, 0, 10.0, 10.0), None);
    }

    #[test]
    fn default_position_fits_small_laptop_screen() {
        // 1366x768 at 100%: the old hard-coded x=1680 was off-screen.
        let displays = vec![d(0, 0, 1366, 728, 1.0)];
        for slot in 0..3 {
            let (x, y) = default_position(&displays, 0, slot, 189.0, 172.0).unwrap();
            assert!(x >= 0 && x + 189 <= 1366, "slot {slot}: x={x}");
            assert!(y >= 0 && y + 172 <= 728, "slot {slot}: y={y}");
        }
    }

    #[test]
    fn default_position_uses_primary_even_if_not_first() {
        let displays = vec![d(-1920, 0, 1920, 1040, 1.0), d(0, 0, 2560, 1400, 1.0)];
        let (x, _) = default_position(&displays, 1, 0, 232.0, 32.0).unwrap();
        assert_eq!(x, 2560 - 232 - 24);
    }

    #[test]
    fn default_slots_do_not_overlap() {
        let displays = vec![d(0, 0, 1920, 1040, 1.0)];
        let a = default_position(&displays, 0, 0, 189.0, 172.0).unwrap();
        let b = default_position(&displays, 0, 1, 189.0, 172.0).unwrap();
        assert!(b.1 >= a.1 + 172);
    }

    #[test]
    fn invalid_scale_falls_back_to_one() {
        let display = d(0, 0, 100, 100, f64::NAN);
        assert_eq!(physical_size(&display, 10.0, 20.0), (10, 20));
    }
}
