import { create } from 'zustand'
import { type Tables } from '@/lib/supabase/types'

type GenerationJob = Tables<'generation_jobs'>

interface GenerationStore {
  activeJobs: Record<string, GenerationJob>
  setJob: (jobId: string, job: GenerationJob) => void
  updateJobStatus: (jobId: string, status: string, resultUrl?: string) => void
  removeJob: (jobId: string) => void
}

export const useGenerationStore = create<GenerationStore>((set) => ({
  activeJobs: {},
  setJob: (jobId, job) =>
    set((state) => ({ activeJobs: { ...state.activeJobs, [jobId]: job } })),
  updateJobStatus: (jobId, status, resultUrl) =>
    set((state) => ({
      activeJobs: {
        ...state.activeJobs,
        [jobId]: state.activeJobs[jobId]
          ? { ...state.activeJobs[jobId], status, result_url: resultUrl ?? state.activeJobs[jobId].result_url }
          : state.activeJobs[jobId],
      },
    })),
  removeJob: (jobId) =>
    set((state) => {
      const next = { ...state.activeJobs }
      delete next[jobId]
      return { activeJobs: next }
    }),
}))
