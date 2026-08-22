import { useEffect, useState } from 'react'
import './dashboard.css'

const sampleJobs = [
  {
    id: 'job-1',
    company: 'Northstar Labs',
    role: 'Frontend Developer',
    location: 'Remote',
    status: 'Applied',
    dateApplied: '2026-08-15',
    url: 'https://example.com/jobs/northstar-frontend',
    notes: 'Follow up next week.',
    jobDescription: 'Build and maintain frontend product experiences.',
  },
  {
    id: 'job-2',
    company: 'Brightside Systems',
    role: 'Product Designer',
    location: 'New York, NY',
    status: 'Interview',
    dateApplied: '2026-08-10',
    url: 'https://example.com/jobs/brightside-product-designer',
    notes: 'Prepare portfolio walkthrough.',
    jobDescription: 'Design clear workflows for business software.',
  },
  {
    id: 'job-3',
    company: 'Oak & Pine',
    role: 'Software Engineer',
    location: 'Austin, TX',
    status: 'Saved',
    dateApplied: '',
    url: 'https://example.com/jobs/oak-pine-engineer',
    notes: 'Review role requirements before applying.',
    jobDescription: 'Develop reliable services for a growing platform.',
  },
  {
    id: 'job-4',
    company: 'Atlas Finance',
    role: 'Data Analyst',
    location: 'Chicago, IL',
    status: 'Assessment',
    dateApplied: '2026-08-05',
    url: 'https://example.com/jobs/atlas-data-analyst',
    notes: 'Complete the take-home assessment.',
    jobDescription: 'Turn product and business data into useful insights.',
  },
]

function Dashboard() {
  const [jobs, setJobs] = useState(null)

  useEffect(() => {
    async function loadJobs() {
      const stored = await window.chrome.storage.local.get('jobs')
      const hasJobsKey = Object.prototype.hasOwnProperty.call(stored, 'jobs')

      if (!hasJobsKey) {
        await window.chrome.storage.local.set({ jobs: sampleJobs })
        setJobs(sampleJobs)
        return
      }

      setJobs(stored.jobs)
    }

    loadJobs()
  }, [])

  if (jobs === null) {
    return <main className="dashboard">Loading jobs...</main>
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <p className="eyebrow">Job Application Assistant</p>
        <h1>Job Application Dashboard</h1>
      </header>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">Role</th>
              <th scope="col">Location</th>
              <th scope="col">Status</th>
              <th scope="col">Date Applied</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.company}</td>
                <td>{job.role}</td>
                <td>{job.location}</td>
                <td>
                  <span className="status">{job.status}</span>
                </td>
                <td>{job.dateApplied || 'Not applied'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

export default Dashboard