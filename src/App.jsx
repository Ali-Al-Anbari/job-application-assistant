import { useEffect, useState } from 'react'
import { extractJobFromPage } from './extractJobFromPage.js'
import { appendJob } from './jobStorage.js'
import './App.css'

const popupStatuses = [
  'Saved',
  'Applied',
  'Assessment',
  'Interview',
  'Offer',
  'Rejected',
  'Withdrawn',
]

function getDescriptionPreview(description) {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' })
    const sentences = Array.from(segmenter.segment(description), ({ segment }) => segment)
    return { text: sentences.slice(0, 2).join('').trim(), hasMore: sentences.length > 2 }
  }

  const sentences = description.match(/.*?(?:[.!?](?=\s|$)|$)/g)?.filter(Boolean) || []
  return {
    text: sentences.slice(0, 2).join('').trim() || description,
    hasMore: sentences.length > 2,
  }
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m4 16.5-.5 4 4-.5L19.2 8.3l-3.5-3.5L4 16.5Zm10.3-9.8 3.5 3.5M5.5 18.5l2-2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m5 12 4.5 4.5L19 7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m7 7 10 10M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function InlineEditField({ label, value, placeholder, onSave, multiline = false }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function startEditing() {
    setDraft(value)
    setIsEditing(true)
  }

  function confirmEdit() {
    onSave(draft)
    setIsEditing(false)
  }

  return (
    <div className="inline-field">
      <dt>{label}</dt>
      <dd>
        {isEditing ? (
          <span className="inline-edit-controls">
            {multiline ? (
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus rows="2" />
            ) : (
              <input value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus />
            )}
            <button type="button" className="icon-button confirm-icon" onClick={confirmEdit} aria-label={`Save ${label}`}>
              <CheckIcon />
            </button>
            <button type="button" className="icon-button cancel-icon" onClick={() => setIsEditing(false)} aria-label={`Cancel editing ${label}`}>
              <CloseIcon />
            </button>
          </span>
        ) : (
          <span className="inline-value">
            <span>{value || placeholder}</span>
            <button type="button" className="icon-button" onClick={startEditing} aria-label={`Edit ${label}`}>
              <PencilIcon />
            </button>
          </span>
        )}
      </dd>
    </div>
  )
}

function App() {
  const [extraction, setExtraction] = useState({ loading: true, isJobPosting: false, confidence: 'low', job: null, error: '' })
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [formData, setFormData] = useState({
    company: '',
    role: '',
    location: '',
    status: 'Saved',
    dateApplied: '',
    url: '',
    notes: '',
  })
  const [formError, setFormError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  function openDashboard() {
    window.chrome.tabs.create({ url: window.chrome.runtime.getURL('dashboard.html') })
  }

  useEffect(() => {
    async function extractFromActiveTab() {
      try {
        const [tab] = await window.chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id || !tab.url || /^(chrome|edge|about|devtools):/.test(tab.url)) {
          throw new Error('This page cannot be inspected.')
        }

        const [result] = await window.chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractJobFromPage,
        })
        const extractionResult = result?.result || { isJobPosting: false, confidence: 'low', job: null }
        const job = extractionResult.job || null
        setExtraction({ loading: false, ...extractionResult, error: '' })
        setFormData((current) => ({
          ...current,
          company: job?.company || '',
          role: job?.role || '',
          location: job?.location || '',
          status: 'Saved',
          dateApplied: '',
          url: job?.url || '',
          notes: '',
        }))
        setFormError('')
        setSaveSuccess('')
        setIsDescriptionExpanded(false)
      } catch {
        setExtraction({ loading: false, isJobPosting: false, confidence: 'low', job: null, error: 'Unable to extract job details from this page.' })
        setFormError('')
        setSaveSuccess('')
        setIsDescriptionExpanded(false)
      }
    }

    extractFromActiveTab()
  }, [])

  function handleFormChange(event) {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
    setFormError('')
    setSaveSuccess('')
  }

  function handleInlineFieldSave(field, value) {
    setFormData((current) => ({ ...current, [field]: value }))
    setFormError('')
    setSaveSuccess('')
  }

  async function handleSaveExtractedJob(event) {
    event.preventDefault()
    const company = formData.company.trim()
    const role = formData.role.trim()
    const status = formData.status.trim()

    if (!company || !role || !status) {
      setFormError('Company, role, and status are required.')
      setSaveSuccess('')
      return
    }

    const job = {
      id: window.crypto.randomUUID(),
      company,
      role,
      location: formData.location.trim(),
      status,
      dateApplied: status === 'Saved' ? '' : new Date().toLocaleDateString('en-CA'),
      url: formData.url.trim(),
      notes: formData.notes,
      jobDescription: extraction.job.jobDescription,
    }

    try {
      await appendJob(job)
      setFormError('')
      setSaveSuccess('Application saved successfully.')
    } catch {
      setFormError('Unable to save this application. Please try again.')
      setSaveSuccess('')
    }
  }

  return (
    <main className="popup">
      <header className="popup-header">
        <h1>Job Application Assistant</h1>
        {extraction.loading && <p>Reading this page...</p>}
        {extraction.error && <p className="extraction-error">{extraction.error}</p>}
      </header>

      {!extraction.loading && !extraction.error && !extraction.isJobPosting && (
        <section className="not-job-state">
          <p>This doesn't appear to be a job posting.</p>
          <p>Open a job listing and try again.</p>
        </section>
      )}

      {extraction.isJobPosting && extraction.job && (
        <form className="popup-application-form" onSubmit={handleSaveExtractedJob}>
          <dl className="popup-fields">
            <InlineEditField label="Company" value={formData.company} placeholder="Company not found" onSave={(value) => handleInlineFieldSave('company', value)} />
            <InlineEditField label="Role" value={formData.role} placeholder="Role not found" onSave={(value) => handleInlineFieldSave('role', value)} />
            <InlineEditField label="Location" value={formData.location} placeholder="Location not found" onSave={(value) => handleInlineFieldSave('location', value)} />
            <div className="popup-split-row">
              <div className="popup-field">
                <label htmlFor="popup-status">Status</label>
                <select id="popup-status" name="status" value={formData.status} onChange={handleFormChange} required>
                  {popupStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>
            <InlineEditField label="Notes" value={formData.notes} placeholder="Add a note" onSave={(value) => handleInlineFieldSave('notes', value)} multiline />
            <div className="popup-field description-field">
              <span className="popup-label">Description</span>
              <span className="description-text">
                {extraction.job.jobDescription ? (() => {
                  const preview = getDescriptionPreview(extraction.job.jobDescription)
                  return <>{isDescriptionExpanded ? extraction.job.jobDescription : preview.text}{preview.hasMore && <button type="button" className="description-toggle" onClick={() => setIsDescriptionExpanded((expanded) => !expanded)}>{isDescriptionExpanded ? 'Show less' : 'Show more'}</button>}</>
                })() : 'Description not found'}
              </span>
            </div>
            {formError && <p className="popup-form-error">{formError}</p>}
            {saveSuccess && <p className="popup-save-success">{saveSuccess}</p>}
          </dl>
          <button type="submit" className="save-button">Save Application</button>
        </form>
      )}

      <button type="button" className="dashboard-button" onClick={openDashboard}>Open Dashboard</button>
    </main>
  )
}

export default App
