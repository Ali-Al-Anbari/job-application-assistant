import { useEffect, useState } from 'react'
import { appendJob } from './jobStorage.js'
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

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 16.5-.5 4 4-.5L19.2 8.3l-3.5-3.5L4 16.5Zm10.3-9.8 3.5 3.5M5.5 18.5l2-2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14M10 11v6M14 11v6M9 7V4h6v3m-9 0 1 13h8l1-13" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 5h5v5M19 5l-8 8M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function Dashboard() {
  const [jobs, setJobs] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingJobId, setEditingJobId] = useState(null)
  const [formData, setFormData] = useState(emptyJobForm)
  const [formError, setFormError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedNote, setSelectedNote] = useState(null)

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

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setSelectedNote(null)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
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
    const dateApplied =
      status !== 'Saved' && !formData.dateApplied 
        ? new Date().toLocaleDateString('en-CA')
        : formData.dateApplied

    if (!company || !role || !status) {
      setFormError('Company, role, and status are required.')
      return
    }

    const stored = await window.chrome.storage.local.get('jobs')
    const storedJobs = stored.jobs ?? []
    let updatedJobs

    if (editingJobId) {
      updatedJobs = storedJobs.map((job) =>
        job.id === editingJobId
          ? {
              ...job,
              company,
              role,
              location: formData.location.trim(),
              status,
              dateApplied,
              url: formData.url.trim(),
              notes: formData.notes.trim(),
            }
          : job,
      )
    } else {
      updatedJobs = await appendJob({
        id: window.crypto.randomUUID(),
        company,
        role,
        location: formData.location.trim(),
        status,
        dateApplied: formData.dateApplied,
        url: formData.url.trim(),
        notes: formData.notes.trim(),
        jobDescription: '',
      })
    }

    if (editingJobId) {
      await window.chrome.storage.local.set({ jobs: updatedJobs })
    }
    setJobs(updatedJobs)
    setFormData(emptyJobForm)
    setFormError('')
    setEditingJobId(null)
    setIsFormOpen(false)
  }

  function handleEdit(job) {
    setEditingJobId(job.id)
    setFormData({
      company: job.company,
      role: job.role,
      location: job.location,
      status: job.status,
      dateApplied: job.dateApplied,
      url: job.url,
      notes: job.notes,
    })
    setFormError('')
    setIsFormOpen(true)
  }

  function handleCancelEdit() {
    setEditingJobId(null)
    setFormData(emptyJobForm)
    setFormError('')
    setIsFormOpen(false)
  }

  async function handleDelete(jobId) {
    if (!window.confirm('Delete this application?')) {
      return
    }

    const updatedJobs = jobs.filter((job) => job.id !== jobId)
    await window.chrome.storage.local.set({ jobs: updatedJobs })
    setJobs(updatedJobs)
  }

  if (jobs === null) {
    return <main className="dashboard">Loading jobs...</main>
  }

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const visibleJobs = jobs.filter((job) => {
    const matchesSearch =
      job.company.toLowerCase().includes(normalizedQuery) ||
      job.role.toLowerCase().includes(normalizedQuery) ||
      (job.location ?? '').toLowerCase().includes(normalizedQuery)
    const matchesStatus = statusFilter === 'All' || job.status === statusFilter

    return matchesSearch && matchesStatus
  })

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Job Application Assistant</p>
          <h1>Job Application Dashboard</h1>
          <p className="application-count">
            {jobs.length} {jobs.length === 1 ? 'application' : 'applications'}
          </p>
        </div>
        <div className="dashboard-title-row">
          <button
            type="button"
            onClick={() => {
              setEditingJobId(null)
              setFormData(emptyJobForm)
              setFormError('')
              setIsFormOpen((open) => !open)
            }}
          >
            {isFormOpen && !editingJobId ? 'Close' : 'Add Application'}
          </button>
        </div>
      </header>

      {isFormOpen && (
        <form className="application-form" onSubmit={handleSubmit}>
          <h2>{editingJobId ? 'Edit Application' : 'Add Application'}</h2>
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
          <div className="form-actions">
            <button type="submit">
              {editingJobId ? 'Save Changes' : 'Save Application'}
            </button>
            {editingJobId && (
              <button type="button" className="secondary-button" onClick={handleCancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <div className="dashboard-filters">
        <label>
          Search jobs
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search company, role, or location"
          />
        </label>
        <label>
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="All">All</option>
            {statuses.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {statusOption}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-wrapper">
        {visibleJobs.length === 0 ? (
          <p className="empty-state">No applications match your filters.</p>
        ) : (
          <table>
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">Role</th>
              <th scope="col">Location</th>
              <th scope="col">Status</th>
              <th scope="col">Date Applied</th>
              <th scope="col">Notes</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleJobs.map((job) => (
              <tr key={job.id}>
                <td className="company-cell">{job.company}</td>
                <td className="role-cell">{job.role}</td>
                <td className="location-cell">{job.location}</td>
                <td>
                  <span className="status" data-status={job.status}>
                    {job.status}
                  </span>
                </td>
                <td>{job.dateApplied || 'Not applied'}</td>
                <td className="notes-cell">
                  {job.notes ? (
                    <button
                      type="button"
                      className="notes-preview"
                      onClick={() => setSelectedNote(job)}
                      title="View full note"
                    >
                      {job.notes}
                    </button>
                  ) : (
                    <span className="muted-placeholder">-</span>
                  )}
                </td>
                <td className="actions-cell">
                  <div className="actions-wrapper">
                    {job.url && (
                      <a className="icon-button" href={job.url} target="_blank" rel="noreferrer" aria-label={`Open ${job.company} posting`} title="Open original posting">
                        <ExternalLinkIcon />
                      </a>
                    )}
                    <button type="button" className="icon-button" onClick={() => handleEdit(job)} aria-label={`Edit ${job.company}`} title="Edit application">
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger-icon"
                      onClick={() => handleDelete(job.id)}
                      aria-label={`Delete ${job.company}`}
                      title="Delete application"
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        )}
      </div>
      {selectedNote && (
        <div className="note-modal-backdrop" onClick={() => setSelectedNote(null)}>
          <section className="note-modal" role="dialog" aria-modal="true" aria-labelledby="note-title" onClick={(event) => event.stopPropagation()}>
            <div className="note-modal-header">
              <h2 id="note-title">Note</h2>
                  <button type="button" className="icon-button" onClick={() => setSelectedNote(null)} aria-label="Close note">
                <span aria-hidden="true">x</span>
              </button>
            </div>
            <p className="note-context">
              {selectedNote.company} · {selectedNote.role}
            </p>
            <p className="note-label">Full Note</p>
            <p>{selectedNote.notes}</p>
          </section>
        </div>
      )}
    </main>
  )
}

export default Dashboard