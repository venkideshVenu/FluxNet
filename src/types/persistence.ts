export interface BandwidthSample {
  /** Unix timestamp in seconds (NOT milliseconds). Use `new Date(timestamp * 1000)` for JS Date. */
  timestamp: number;
  downloadBps: number;
  uploadBps: number;
}

export interface HourlyUsage {
  /** Unix timestamp in seconds marking the start of the hour. */
  hourStart: number;
  avgDownloadBps: number;
  avgUploadBps: number;
  peakDownloadBps: number;
  peakUploadBps: number;
  totalDownloadBytes: number;
  totalUploadBytes: number;
  sampleCount: number;
}

export interface DailyUsage {
  /** Date string in "YYYY-MM-DD" format */
  day: string;
  avgDownloadBps: number;
  avgUploadBps: number;
  peakDownloadBps: number;
  peakUploadBps: number;
  totalDownloadBytes: number;
  totalUploadBytes: number;
}

export interface MonthlyUsage {
  /** Month string in "YYYY-MM" format (lexicographic = chronological) */
  month: string;
  totalDownloadBytes: number;
  totalUploadBytes: number;
  peakDownloadBps: number;
  peakUploadBps: number;
}

export interface UsageStats {
  todayDownloadBytes: number;
  todayUploadBytes: number;
  weekDownloadBytes: number;
  weekUploadBytes: number;
  monthDownloadBytes: number;
  monthUploadBytes: number;
  peakDownloadBps: number;
  peakUploadBps: number;
}
