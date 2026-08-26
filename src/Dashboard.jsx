import { useEffect, useRef, useState } from 'react'
import {
  buildSuggestion,
  getMessageBody,
  getJobById,
  getProcessedMessageIds,
  isDigestLike,
  markMessageProcessed,
  scanGmail,
  unmarkMessageProcessed,
} from './gmail.js'
import { appendJob } from './jobStorage.js'
import './dashboard.css'

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

const gmailReadonlyScope = 'https://www.googleapis.com/auth/gmail.readonly'

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

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
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
  const [isSavingApplication, setIsSavingApplication] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [isSavingRow, setIsSavingRow] = useState(false)
  const [formData, setFormData] = useState(emptyJobForm)
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedNote, setSelectedNote] = useState(null)
  const [gmailState, setGmailState] = useState({ status: 'disconnected', email: '', error: '' })
  const [gmailScan, setGmailScan] = useState({ status: 'idle', messages: [], error: '' })
  const [gmailSuggestions, setGmailSuggestions] = useState([])
  const [gmailScanVersion, setGmailScanVersion] = useState(0)
  const [undoState, setUndoState] = useState(null)
  const [isUndoing, setIsUndoing] = useState(false)
  const [updatingMessageId, setUpdatingMessageId] = useState('')
  const [deletingJobId, setDeletingJobId] = useState('')
  const [pendingAddSuggestion, setPendingAddSuggestion] = useState(null)
  const [gmailBody, setGmailBody] = useState({
    messageId: '',
    status: 'idle',
    text: '',
    truncated: false,
    error: '',
  })
  const [isEmailExpanded, setIsEmailExpanded] = useState(false)
  const bodyFetchRef = useRef('')


  useEffect(() => {
  async function restoreGmailConnection() {
    try {
      const authResult = await window.chrome.identity.getAuthToken({
        interactive: false,
      })

      const token = authResult?.token || authResult
      const grantedScopes = authResult?.grantedScopes

      if (!token || !Array.isArray(grantedScopes) || !grantedScopes.includes(gmailReadonlyScope)) {
        if (token) {
          await window.chrome.identity.removeCachedAuthToken({ token }).catch(() => {})
        }
        return
      }

      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (response.status === 401) {
        await window.chrome.identity.removeCachedAuthToken({ token })
        return
      }

      if (!response.ok) {
        return
      }

      const profile = await response.json()

      setGmailState({
        status: 'connected',
        email: profile.emailAddress || '',
        error: '',
      })
    } catch {
      // No cached Gmail authorization.
      // Leave the dashboard disconnected.
    }
  }

  restoreGmailConnection()
}, [])


  useEffect(() => {
    async function loadJobs() {
      const stored = await window.chrome.storage.local.get('jobs')
      const storedJobs = stored.jobs ?? []
      setJobs(storedJobs)
    }

    loadJobs()
  }, [])

  const currentSuggestionId = gmailSuggestions[0]?.id || ''

  useEffect(() => {
    if (!currentSuggestionId || !jobs) return

    const messageId = currentSuggestionId
    let cancelled = false

    async function loadBody() {
      bodyFetchRef.current = messageId
      setGmailBody({
        messageId,
        status: 'loading',
        text: '',
        truncated: false,
        error: '',
      })
      try {
        const authResult = await window.chrome.identity.getAuthToken({ interactive: false })
        const token = authResult?.token || authResult
        const grantedScopes = authResult?.grantedScopes

        if (!token || !Array.isArray(grantedScopes) || !grantedScopes.includes(gmailReadonlyScope)) {
          const error = new Error('Gmail needs to be reconnected with read-only email access.')
          error.requiresScope = true
          error.token = token
          throw error
        }

        const bodyResult = await getMessageBody(token, messageId)
        if (cancelled || bodyFetchRef.current !== messageId) return
        let isStrongDigest = false
        setGmailSuggestions((suggestions) => {
          const currentSuggestion = suggestions.find((item) => item.id === messageId)
          isStrongDigest = Boolean(currentSuggestion && bodyResult.text && isDigestLike(currentSuggestion.subject, bodyResult.text))
          if (isStrongDigest) {
            return suggestions.filter((item) => item.id !== messageId)
          }

          return suggestions.map((item) => {
            if (item.id !== messageId) return item
            const enrichedSuggestion = buildSuggestion({ ...item, bodyText: bodyResult.text }, jobs)
            return {
              ...enrichedSuggestion,
              selectedJobId: item.selectedJobId || enrichedSuggestion.jobId,
              selectedStatus: item.selectedStatusManuallyChanged ? item.selectedStatus : enrichedSuggestion.suggestedStatus,
              selectedStatusManuallyChanged: Boolean(item.selectedStatusManuallyChanged),
            }
          })
        })
        if (isStrongDigest) {
          bodyFetchRef.current = ''
          await markMessageProcessed(messageId)
          if (cancelled) return
          setGmailBody({ messageId: '', status: 'idle', text: '', truncated: false, error: '' })
          setIsEmailExpanded(false)
          return
        }

        setGmailBody({
          messageId,
          status: bodyResult.text ? 'loaded' : 'unavailable',
          text: bodyResult.text,
          truncated: bodyResult.truncated,
          error: bodyResult.text ? '' : 'Email body unavailable',
        })
      } catch (error) {
        if (bodyFetchRef.current === messageId) {
          bodyFetchRef.current = ''
        }
        if (cancelled) return
        const bodyError = error.requiresScope
          ? 'Gmail needs to be reconnected with read-only email access.'
          : 'Email body unavailable. Try again.'
        setGmailBody({
          messageId,
          status: 'error',
          text: '',
          truncated: false,
          error: bodyError,
        })
        if (error.status === 401 || error.requiresScope) {
          const tokenToRemove = error.token
          if (tokenToRemove) {
            await window.chrome.identity.removeCachedAuthToken({ token: tokenToRemove }).catch(() => {})
          }
          setGmailState({
            status: 'disconnected',
            email: '',
            error: error.requiresScope
              ? 'Gmail needs to be reconnected with read-only email access.'
              : 'Gmail authentication expired.',
          })
        }
      }
    }

    loadBody()
    return () => {
      cancelled = true
      if (bodyFetchRef.current === messageId) {
        bodyFetchRef.current = ''
      }
    }
  }, [currentSuggestionId, gmailScanVersion, jobs])

  async function connectGmail() {
    setGmailState({ status: 'connecting', email: '', error: '' })

    try {
      const authResult = await window.chrome.identity.getAuthToken({ interactive: true })
      const token = authResult?.token || authResult
      const grantedScopes = authResult?.grantedScopes

      if (!token || !Array.isArray(grantedScopes) || !grantedScopes.includes(gmailReadonlyScope)) {
        if (token) {
          await window.chrome.identity.removeCachedAuthToken({ token }).catch(() => {})
        }
        throw new Error('Gmail needs to be reconnected with read-only email access.')
      }

      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (response.status === 401) {
        await window.chrome.identity.removeCachedAuthToken({ token })
        throw new Error('Gmail authentication expired.')
      }

      if (!response.ok) {
        throw new Error('Gmail profile request failed.')
      }

      const profile = await response.json()
      setGmailState({
        status: 'connected',
        email: profile.emailAddress || '',
        error: '',
      })
    } catch {
      setGmailState({
        status: 'disconnected',
        email: '',
        error: 'Unable to connect Gmail right now.',
      })
    }
  }

  async function checkGmail() {
    setGmailScan({ status: 'checking', messages: [], error: '' })
    setGmailScanVersion((version) => version + 1)
    bodyFetchRef.current = ''
    setGmailBody({ messageId: '', status: 'idle', text: '', truncated: false, error: '' })
    setIsEmailExpanded(false)
    let token

    try {
      const authResult = await window.chrome.identity.getAuthToken({ interactive: false })
      token = authResult?.token || authResult
      const grantedScopes = authResult?.grantedScopes

      if (!token || !Array.isArray(grantedScopes) || !grantedScopes.includes(gmailReadonlyScope)) {
        const error = new Error('Gmail needs to be reconnected with read-only email access.')
        error.requiresScope = true
        throw error
      }

      const processedIds = await getProcessedMessageIds()
      const suggestions = await scanGmail(token, jobs, processedIds)
      setGmailSuggestions(suggestions.map((suggestion) => ({
        ...suggestion,
        selectedJobId: suggestion.jobId,
        selectedStatus: suggestion.suggestedStatus,
        selectedStatusManuallyChanged: false,
      })))
      setGmailScan({ status: 'success', messages: suggestions, error: '' })
    } catch (error) {
      if (error.status === 401 || error.requiresScope) {
        if (token) {
          await window.chrome.identity.removeCachedAuthToken({ token })
        }
        setGmailState({
          status: 'disconnected',
          email: '',
          error: error.requiresScope
            ? 'Gmail needs to be reconnected with read-only email access.'
            : 'Gmail authentication expired.',
        })
      }
      setGmailScan({
        status: 'error',
        messages: [],
        error: 'Unable to check Gmail right now.',
      })
    }
  }

  function ignoreSuggestion(messageId) {
    markMessageProcessed(messageId).then(() => {
      setIsEmailExpanded(false)
      setGmailSuggestions((suggestions) => suggestions.filter((suggestion) => suggestion.id !== messageId))
    })
  }

  function skipSuggestion(messageId) {
    setIsEmailExpanded(false)
    setGmailSuggestions((suggestions) => suggestions.filter((suggestion) => suggestion.id !== messageId))
  }

  function selectSuggestionJob(messageId, jobId) {
    setGmailSuggestions((suggestions) =>
      suggestions.map((suggestion) =>
        suggestion.id === messageId ? { ...suggestion, selectedJobId: jobId } : suggestion,
      ),
    )
  }

  function selectSuggestionStatus(messageId, status) {
    setGmailSuggestions((suggestions) =>
      suggestions.map((suggestion) =>
        suggestion.id === messageId
          ? { ...suggestion, selectedStatus: status, selectedStatusManuallyChanged: true }
          : suggestion,
      ),
    )
  }

  function startAddFromSuggestion(suggestion) {
    setPendingAddSuggestion(suggestion)
    setFormData({
      ...emptyJobForm,
      company: suggestion.inferredCompany || '',
      role: suggestion.inferredRole || '',
      status: suggestion.selectedStatus || suggestion.suggestedStatus || '',
      dateApplied: suggestion.classification === 'Application Received' ? suggestion.emailDate || '' : '',
    })
    setFormError('')
    setIsFormOpen(true)
  }

  async function confirmSuggestion(suggestion) {
    if (updatingMessageId) {
      return
    }
    const jobId = suggestion.selectedJobId
    const job = getJobById(jobs, jobId)
    const selectedStatus = suggestion.selectedStatus || suggestion.suggestedStatus

    if (!job || !selectedStatus) {
      return
    }

    if (job.status === selectedStatus) {
      return
    }

    const previousJob = { ...job }
    const updatedJobs = jobs.map((currentJob) =>
      currentJob.id === job.id
        ? {
            ...currentJob,
            status: selectedStatus,
            dateApplied:
              currentJob.dateApplied ||
              (suggestion.classification === 'Application Received'
                ? suggestion.emailDate || ''
                : ''),
          }
        : currentJob,
    )

    setUpdatingMessageId(suggestion.id)
    setActionError('')
    try {
      await window.chrome.storage.local.set({ jobs: updatedJobs })
      await markMessageProcessed(suggestion.id)
      setJobs(updatedJobs)
      setUndoState({ type: 'updated', job: previousJob, suggestion })
      setIsEmailExpanded(false)
      setGmailSuggestions((suggestions) => suggestions.filter((item) => item.id !== suggestion.id))
    } catch {
      setActionError('Unable to update application. Try again.')
    } finally {
      setUpdatingMessageId('')
    }
  }

  async function handleUndoUpdate() {
    if (!undoState || isUndoing) {
      return
    }

    setIsUndoing(true)
    setActionError('')
    try {
      const restoredJobs = undoState.type === 'created'
        ? jobs.filter((job) => job.id !== undoState.jobId)
        : jobs.map((job) =>
          job.id === undoState.job.id ? undoState.job : job,
        )
      await window.chrome.storage.local.set({ jobs: restoredJobs })
      await unmarkMessageProcessed(undoState.suggestion.id)
      setJobs(restoredJobs)
      setGmailSuggestions((suggestions) => [
        undoState.suggestion,
        ...suggestions,
      ])
      bodyFetchRef.current = ''
      setGmailBody({ messageId: '', status: 'idle', text: '', truncated: false, error: '' })
      setIsEmailExpanded(false)
      setUndoState(null)
    } catch {
      setActionError('Unable to undo application update. Try again.')
    } finally {
      setIsUndoing(false)
    }
  }

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
    if (isSavingApplication) return
    const sourceSuggestion = pendingAddSuggestion

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

    setIsSavingApplication(true)
    setActionError('')
    try {
      const updatedJobs = await appendJob({
        id: window.crypto.randomUUID(),
        company,
        role,
        location: formData.location.trim(),
        status,
        dateApplied,
        url: formData.url.trim(),
        notes: formData.notes.trim(),
        jobDescription: '',
      })
      if (sourceSuggestion) {
        await markMessageProcessed(sourceSuggestion.id)
        setGmailSuggestions((suggestions) => suggestions.filter((suggestion) => suggestion.id !== sourceSuggestion.id))
        setPendingAddSuggestion(null)
        const createdJob = updatedJobs.find((job) => !jobs.some((currentJob) => currentJob.id === job.id))
        if (createdJob) {
          setUndoState({ type: 'created', jobId: createdJob.id, suggestion: sourceSuggestion })
        }
      }

      setJobs(updatedJobs)
      setFormData(emptyJobForm)
      setFormError('')
      setIsFormOpen(false)
    } catch {
      setFormError('Unable to save application. Try again.')
    } finally {
      setIsSavingApplication(false)
    }
  }

  function startRowEdit(job) {
    setEditingRow({
      jobId: job.id,
      draft: {
        company: job.company,
        role: job.role,
        location: job.location,
        status: job.status,
        dateApplied: job.dateApplied,
        notes: job.notes,
      },
    })
  }

  function updateRowDraft(field, value) {
    setEditingRow((current) => current ? {
      ...current,
      draft: { ...current.draft, [field]: value },
    } : current)
  }

  async function saveRowEdit() {
    if (!editingRow || isSavingRow) return
    const { draft, jobId } = editingRow
    const company = draft.company.trim()
    const role = draft.role.trim()
    if (!company || !role || !draft.status) return

    const updatedJobs = jobs.map((job) => job.id === jobId
      ? {
          ...job,
          company,
          role,
          location: draft.location.trim(),
          status: draft.status,
          dateApplied: draft.status !== 'Saved' && !draft.dateApplied
            ? new Date().toLocaleDateString('en-CA')
            : draft.dateApplied,
          notes: draft.notes.trim(),
        }
      : job)
    setIsSavingRow(true)
    setActionError('')
    try {
      await window.chrome.storage.local.set({ jobs: updatedJobs })
      setJobs(updatedJobs)
      setEditingRow(null)
    } catch {
      setActionError('Unable to save application. Try again.')
    } finally {
      setIsSavingRow(false)
    }
  }

  function cancelRowEdit() {
    setEditingRow(null)
  }

  async function handleDelete(jobId) {
    if (deletingJobId) return
    if (!window.confirm('Delete this application?')) {
      return
    }

    setDeletingJobId(jobId)
    setActionError('')
    try {
      const updatedJobs = jobs.filter((job) => job.id !== jobId)
      await window.chrome.storage.local.set({ jobs: updatedJobs })
      setJobs(updatedJobs)
    } catch {
      setActionError('Unable to delete application. Try again.')
    } finally {
      setDeletingJobId('')
    }
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
        <div className={`gmail-status gmail-${gmailState.status}`}>
          {gmailState.status === 'connected' ? (
            <>
              <div className="gmail-account">
                <strong>Gmail connected</strong>
                <span>{gmailState.email}</span>
              </div>

              <button
                type="button"
                onClick={checkGmail}
                disabled={gmailScan.status === 'checking'}
              >
                {gmailScan.status === 'checking' ? 'Checking Gmail from the last 7 days...' : 'Check Gmail'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={connectGmail}
              disabled={gmailState.status === 'connecting'}
            >
              {gmailState.status === 'connecting'
                ? 'Connecting...'
                : 'Connect Gmail'}
            </button>
          )}

          {gmailState.error && (
            <span className="gmail-error">{gmailState.error}</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (isFormOpen) setPendingAddSuggestion(null)
            setFormData(emptyJobForm)
            setFormError('')
            setIsFormOpen((open) => !open)
          }}
        >
          {isFormOpen ? 'Close' : 'Add Application'}
        </button>
      </div>
      </header>

      {gmailScan.status !== 'idle' && (
        <section className="gmail-results" aria-live="polite">
          <h2>Recent application emails</h2>
          {gmailScan.status === 'checking' && <p>Checking Gmail from the last 7 days...</p>}
          {gmailScan.status === 'error' && <p className="gmail-error">{gmailScan.error}</p>}
          {gmailSuggestions.length === 0 && gmailScan.status === 'success' && (
            <p>No application emails to review from the last 7 days.</p>
          )}
          {gmailSuggestions.length > 0 && (
            <div className="gmail-message-list">
              {(() => {
                const message = gmailSuggestions[0]
                const isReviewable = gmailBody.messageId === message.id && (gmailBody.status === 'loaded' || gmailBody.status === 'error' || gmailBody.status === 'unavailable')

                if (!isReviewable) {
                  return (
                    <div className="gmail-message gmail-validating" aria-live="polite">
                      <span className="gmail-validation-message">Checking email...</span>
                    </div>
                  )
                }

                return (
                <article key={message.id} className="gmail-message">
                  <span className="gmail-queue-count">Email to review</span>
                  <strong>{message.from || 'Unknown sender'}</strong>
                  <span>{message.subject || '(No subject)'}</span>
                  {message.threadId && (
                    <a
                      className="icon-button gmail-open-link"
                      href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(message.threadId)}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open email in Gmail"
                      title="Open email in Gmail"
                    >
                      <ExternalLinkIcon />
                    </a>
                  )}
                  <time dateTime={message.internalDate ? new Date(Number(message.internalDate)).toISOString() : undefined}>
                    {message.internalDate
                      ? new Date(Number(message.internalDate)).toLocaleDateString()
                      : 'Unknown date'}
                  </time>
                  <span className="gmail-classification">
                    Likely update: {message.classification} ({message.confidence} match)
                  </span>
                  {message.classification === 'Unknown' && (
                    <span className="gmail-status-note">
                      Not enough information to suggest an application update.
                    </span>
                  )}
                  {message.classification !== 'Unknown' && (
                    <span className="gmail-match">
                      {message.confidence === 'ambiguous'
                        ? 'Multiple applications may match'
                        : message.jobId
                          ? `Matched: ${getJobById(jobs, message.jobId)?.company} - ${getJobById(jobs, message.jobId)?.role}`
                          : 'No matching application'}
                    </span>
                  )}
                  {message.classification !== 'Unknown' && message.currentStatus && message.suggestedStatus && (
                    <span className="gmail-status-change">
                      Current status: {message.currentStatus} | Suggested status: {message.suggestedStatus}
                    </span>
                  )}
                  {message.classification !== 'Unknown' && message.statusSuppressed && (
                    <span className="gmail-status-note">Suggested update is not a forward status change.</span>
                  )}
                  <div className="gmail-body">
                    <strong className="gmail-body-label">Email body</strong>
                    {gmailBody.messageId !== message.id || gmailBody.status === 'loading' ? (
                      <span className="gmail-body-message">{gmailBody.status === 'loading' ? 'Loading email body...' : 'Email body unavailable'}</span>
                    ) : gmailBody.text ? (
                      <>
                        <p className={isEmailExpanded ? 'gmail-body-text expanded' : 'gmail-body-text'}>
                          {gmailBody.text}
                        </p>
                        {(gmailBody.text.split('\n').length > 8 || gmailBody.text.length > 500 || gmailBody.truncated) && (
                          <button type="button" className="gmail-body-toggle" onClick={() => setIsEmailExpanded((expanded) => !expanded)}>
                            {isEmailExpanded ? 'Show less' : 'Show more'}
                          </button>
                        )}
                        {gmailBody.truncated && isEmailExpanded && (
                          <span className="gmail-body-message">Only part of this email is displayed.</span>
                        )}
                      </>
                    ) : (
                      <span className="gmail-body-message">{gmailBody.error || 'Email body unavailable'}</span>
                    )}
                  </div>
                  <label className="gmail-status-override">
                    Update status
                    <select
                      value={message.selectedStatus || ''}
                      onChange={(event) => selectSuggestionStatus(message.id, event.target.value)}
                    >
                      <option value="">Select status...</option>
                      {statuses.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {statusOption}
                        </option>
                      ))}
                    </select>
                  </label>
                  {message.classification !== 'Unknown' &&
                    (message.confidence === 'ambiguous' || !message.jobId) && (
                    <select
                      value={message.selectedJobId || ''}
                      onChange={(event) => selectSuggestionJob(message.id, event.target.value)}
                    >
                      <option value="">Select an application</option>
                      {jobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.company} - {job.role}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="gmail-suggestion-actions">
                    {(message.selectedStatus || message.suggestedStatus) && (message.selectedJobId || message.jobId) && (
                      <button
                        type="button"
                        onClick={() => confirmSuggestion(message)}
                        disabled={Boolean(updatingMessageId) || getJobById(jobs, message.selectedJobId)?.status === (message.selectedStatus || message.suggestedStatus)}
                      >
                        {updatingMessageId === message.id ? 'Updating...' : 'Confirm Update'}
                      </button>
                    )}
                    {(message.selectedStatus || message.suggestedStatus) && message.confidence === 'none' && !message.selectedJobId && !message.jobId && (
                      <button type="button" onClick={() => startAddFromSuggestion(message)}>
                        Add Application
                      </button>
                    )}
                    <button type="button" className="skip-button" onClick={() => skipSuggestion(message.id)}>
                      Skip for now
                    </button>
                    <button type="button" className="secondary-button" onClick={() => ignoreSuggestion(message.id)}>
                      Ignore
                    </button>
                  </div>
                </article>
                )
              })()}
            </div>
          )}
        </section>
      )}

      {undoState && (
        <div className="gmail-undo">
          Application updated.
          <button type="button" onClick={handleUndoUpdate} disabled={isUndoing}>{isUndoing ? 'Undoing...' : 'Undo'}</button>
        </div>
      )}

      {actionError && <p className="form-error dashboard-action-error">{actionError}</p>}

      {isFormOpen && (
        <form className="application-form" onSubmit={handleSubmit}>
          <h2>Add Application</h2>
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
            <button type="submit" disabled={isSavingApplication}>
              {isSavingApplication ? 'Saving...' : 'Save Application'}
            </button>
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
          jobs.length === 0 ? (
            <section className="empty-state" aria-labelledby="empty-dashboard-title">
              <strong id="empty-dashboard-title">No applications yet</strong>
              <p>Save a job from the extension or add one manually to get started.</p>
              <button type="button" onClick={() => setIsFormOpen(true)}>Add Application</button>
            </section>
          ) : (
            <p className="empty-state">No applications match your filters.</p>
          )
        ) : (
          <table>
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">Role</th>
              <th scope="col">Location</th>
              <th scope="col">Status</th>
              <th scope="col" className="date-column">Date Applied</th>
              <th scope="col">Notes</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleJobs.map((job) => {
              const isEditing = editingRow?.jobId === job.id
              const draft = isEditing ? editingRow.draft : null

              return (
                <tr key={job.id}>
                  {isEditing ? (
                    <>
                      <td><input className="row-edit-input" value={draft.company} onChange={(event) => updateRowDraft('company', event.target.value)} aria-label="Company" /></td>
                      <td><input className="row-edit-input" value={draft.role} onChange={(event) => updateRowDraft('role', event.target.value)} aria-label="Role" /></td>
                      <td><input className="row-edit-input" value={draft.location} onChange={(event) => updateRowDraft('location', event.target.value)} aria-label="Location" /></td>
                      <td>
                        <select className="row-edit-input" value={draft.status} onChange={(event) => updateRowDraft('status', event.target.value)} aria-label="Status">
                          {statuses.map((statusOption) => <option key={statusOption} value={statusOption}>{statusOption}</option>)}
                        </select>
                      </td>
                      <td className="date-cell"><input className="row-edit-input" type="date" value={draft.dateApplied} onChange={(event) => updateRowDraft('dateApplied', event.target.value)} aria-label="Date Applied" /></td>
                      <td className="notes-cell"><textarea className="row-edit-input row-edit-notes" value={draft.notes} onChange={(event) => updateRowDraft('notes', event.target.value)} rows="2" aria-label="Notes" /></td>
                      <td className="actions-cell">
                        <div className="actions-wrapper">
                          <button type="button" className="icon-button confirm-icon" onClick={saveRowEdit} disabled={isSavingRow} aria-label="Save application changes" title="Save changes"><CheckIcon /></button>
                          <button type="button" className="icon-button cancel-icon" onClick={cancelRowEdit} aria-label="Cancel application changes" title="Cancel changes"><CloseIcon /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
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
                          <button type="button" className="icon-button" onClick={() => startRowEdit(job)} aria-label={`Edit ${job.company}`} title="Edit application">
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="icon-button danger-icon"
                            onClick={() => handleDelete(job.id)}
                            disabled={Boolean(deletingJobId)}
                            aria-label={`Delete ${job.company}`}
                            title="Delete application"
                          >
                            <DeleteIcon />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
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