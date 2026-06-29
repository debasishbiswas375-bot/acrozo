import { useState, useEffect, useCallback } from 'react';

interface JobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: {
    output_file: string;
    details: string;
    download_url: string;
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const useJobPolling = (jobId: string | null, interval: number = 2000) => {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollJob = useCallback(async () => {
    if (!jobId) return;

    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch job status');
      }

      setJobStatus(data);
      setError(null);

      // Stop polling if job is completed or failed
      if (data.status === 'completed' || data.status === 'failed') {
        setIsPolling(false);
        return data.status;
      }

      return data.status;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsPolling(false);
      return 'failed';
    }
  }, [jobId]);

  const startPolling = useCallback(() => {
    if (!jobId) return;

    setIsPolling(true);
    setError(null);

    // Initial poll
    pollJob();

    // Set up interval polling
    const intervalId = setInterval(pollJob, interval);

    // Cleanup on unmount or when polling stops
    return () => {
      clearInterval(intervalId);
      setIsPolling(false);
    };
  }, [jobId, interval, pollJob]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  // Auto-start polling when jobId changes
  useEffect(() => {
    if (jobId) {
      const cleanup = startPolling();
      return cleanup;
    }
  }, [jobId, startPolling]);

  return {
    jobStatus,
    isPolling,
    error,
    startPolling,
    stopPolling,
    pollJob
  };
};
