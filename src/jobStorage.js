export async function appendJob(job) {
  const stored = await window.chrome.storage.local.get('jobs')
  const storedJobs = stored.jobs ?? []
  const updatedJobs = [...storedJobs, job]

  await window.chrome.storage.local.set({ jobs: updatedJobs })
  return updatedJobs
}
