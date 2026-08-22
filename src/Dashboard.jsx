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

const emptyJobForm = {
  company: '',
  role: '',
  location: '',
  status: '',
  dateApplied: '',
  url: '',
  notes: '',
}

const statuses = [
  'Saved',
  'Applied',
  'Assessment',
  'Interview',
  'Offer',
  'Rejected',
  'Withdrawn',
]

function Dashboard() {
  const [jobs, setJobs] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState(emptyJobForm)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    async function loadJobs() {
      const stored = await window.chrome.storage.local.get('jobs')
      const hasJobsKey = Object.prototype.hasOwnProperty.call(stored, 'jobs')

      if (!hasJobsKey) {
        await window.chrome.storage.local.set({ jobs: sampleJobs })
        setJobs(sampleJobs)
        return
      }

      setJobs(stored.jobs ?? [])
    }

    loadJobs()
  }, [])

  function handleFormChange(event) {
    const { name, value } = event.target
    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const company = formData.company.trim()
    const role = formData.role.trim()
    const status = formData.status.trim()

    if (!company || !role || !status) {
      setFormError('Company, role, and status are required.')
      return
    }

    const newJob = {
      id: window.crypto.randomUUID(),
      company,
      role,
      location: formData.location.trim(),
      status,
      dateApplied: formData.dateApplied,
      url: formData.url.trim(),
      notes: formData.notes.trim(),
      jobDescription: '',
    }
    const stored = await window.chrome.storage.local.get('jobs')
    const storedJobs = stored.jobs ?? []
    const updatedJobs = [...storedJobs, newJob]

    await window.chrome.storage.local.set({ jobs: updatedJobs })
    setJobs(updatedJobs)
    setFormData(emptyJobForm)
    setFormError('')
    setIsFormOpen(false)
  }

  if (jobs === null) {
    return <main className="dashboard">Loading jobs...</main>
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <p className="eyebrow">Job Application Assistant</p>
        <div className="dashboard-title-row">
          <h1>Job Application Dashboard</h1>
          <button type="button" onClick={() => setIsFormOpen((open) => !open)}>
            Add Application
          </button>
        </div>
      </header>

      {isFormOpen && (
        <form className="application-form" onSubmit={handleSubmit}>
          <label>
            Company *
            <input
              name="company"
              value={formData.company}
              onChange={handleFormChange}
              required
            />
          </label>
          <label>
            Role *
            <input
              name="role"
              value={formData.role}
              onChange={handleFormChange}
              required
            />
          </label>
          <label>
            Location
            <input
              name="location"
              value={formData.location}
              onChange={handleFormChange}
            />
          </label>
          <label>
            Status *
            <select
              name="status"
              value={formData.status}
              onChange={handleFormChange}
              required
            >
              <option value="">Select a status</option>
              {statuses.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date Applied
            <input
              type="date"
              name="dateApplied"
              value={formData.dateApplied}
              onChange={handleFormChange}
            />
          </label>
          <label>
            Job URL
            <input
              type="url"
              name="url"
              value={formData.url}
              onChange={handleFormChange}
            />
          </label>
          <label>
            Notes
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleFormChange}
              rows="3"
            />
          </label>
          {formError && <p className="form-error">{formError}</p>}
          <button type="submit">Save Application</button>
        </form>
      )}

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