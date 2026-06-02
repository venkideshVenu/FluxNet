export interface BandwidthSample {
  timestamp: number; // Unix seconds
  downloadBps: number;
  uploadBps: number;
}

export interface HourlyUsage {
  hourStart: number; // Unix seconds
  avgDownloadBps: number;
  avgUploadBps: number;
  peakDownloadBps: number;
  peakUploadBps: number;
  totalDownloadBytes: number;
  totalUploadBytes: number;
  sampleCount: number;
}

export interface DailyUsage {
  day: string; // "YYYY-MM-DD"
  avgDownloadBps: number;
  avgUploadBps: number;
  peakDownloadBps: number;
  peakUploadBps: number;
  totalDownloadBytes: number;
  totalUploadBytes: number;
}

export interface MonthlyUsage {
  month: string; // "YYYY-MM"
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
