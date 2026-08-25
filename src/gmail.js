const classificationRules = [
  {
    name: 'Rejected',
    status: 'Rejected',
    signals: ['decided not to move forward', 'will not be moving forward', 'not moving forward', 'unfortunately', 'other candidates'],
  },
  {
    name: 'Offer',
    status: 'Offer',
    signals: ['offer letter', 'employment offer', 'pleased to offer', 'job offer'],
  },
  {
    name: 'Assessment',
    status: 'Assessment',
    signals: ['coding assessment', 'technical assessment', 'coding challenge', 'take-home', 'online assessment', 'assessment'],
  },
  {
    name: 'Interview',
    status: 'Interview',
    signals: ['next round', 'schedule a call', 'schedule a conversation', 'interview', 'availability'],
  },
  {
    name: 'Application Received',
    status: 'Applied',
    signals: ['application received', 'received your application', 'thank you for applying', 'thanks for applying', 'application confirmation'],
  },
]

const jobRelatedSignals = [
  'application',
  'applying',
  'applied',
  'candidate',
  'recruiting',
  'recruiter',
  'interview',
  'assessment',
  'coding challenge',
  'technical assessment',
  'take-home',
  'thank you for applying',
  'thanks for applying',
  'received your application',
  'application received',
  'job offer',
  'offer letter',
  'employment offer',
  'hiring team',
  'unfortunately',
  'moving forward',
]

function normalizeText(value) {
  return String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeCompany(value) {
  return normalizeText(value).replace(/\b(inc|llc|ltd|corp|corporation|co)\b$/, '').trim()
}

function getHeader(headers, name) {
  return headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value?.trim() || ''
}

function normalizeFrom(value) {
  const match = value.match(/^(.*?)\s*<([^>]+)>$/)
  return {
    displayName: (match ? match[1] : '').replace(/^"|"$/g, '').trim(),
    email: (match ? match[2] : value).trim().toLowerCase(),
  }
}

function inferCompanyFromSender(value) {
  const normalized = normalizeFrom(value)
  const genericNames = /^(google|gmail|notifications?|no reply|noreply|recruiting|recruiter|hiring team)$/i
  if (!normalized.displayName || genericNames.test(normalized.displayName)) {
    return ''
  }

  return normalized.displayName
}

function classifyMessage(subject, from) {
  const text = normalizeText(`${subject} ${from}`)
  const interviewRule = classificationRules.find((rule) => rule.name === 'Interview')
  const hasInterviewSignal = interviewRule.signals.some((signal) => text.includes(normalizeText(signal)))

  for (const rule of classificationRules) {
    if (rule.signals.some((signal) => text.includes(normalizeText(signal)))) {
      return { name: rule.name, suggestedStatus: rule.status }
    }
  }

  if (text.includes('next steps') && hasInterviewSignal) {
    return { name: 'Interview', suggestedStatus: 'Interview' }
  }

  return { name: 'Unknown', suggestedStatus: '' }
}

function getRoleTokens(role) {
  return normalizeText(role).split(' ').filter((token) => token.length > 2 && !['and', 'the', 'for', 'with'].includes(token))
}

function matchMessageToJobs(message, jobs) {
  const from = normalizeFrom(message.from)
  const subjectText = normalizeText(message.subject)
  const senderText = normalizeText(`${from.displayName} ${from.email.split('@')[0]}`)
  const candidates = jobs.filter((job) => {
    const company = normalizeCompany(job.company)
    return company && (subjectText.includes(company) || senderText.includes(company))
  })

  if (candidates.length === 0) return { confidence: 'none', jobId: '', candidateJobIds: [] }

  const roleMatches = candidates.filter((job) => getRoleTokens(job.role).some((token) => subjectText.includes(token)))
  if (roleMatches.length === 1) return { confidence: 'strong', jobId: roleMatches[0].id, candidateJobIds: [roleMatches[0].id] }
  if (candidates.length === 1) return { confidence: 'possible', jobId: candidates[0].id, candidateJobIds: [candidates[0].id] }
  return { confidence: 'ambiguous', jobId: '', candidateJobIds: candidates.map((job) => job.id) }
}

function parseDate(value) {
  const parsed = Date.parse(value || '')
  return Number.isNaN(parsed) ? '' : new Date(parsed).toLocaleDateString('en-CA')
}

function buildSuggestion(message, jobs) {
  const classification = classifyMessage(message.subject, message.from)
  const match = matchMessageToJobs(message, jobs)
  const matchedJob = jobs.find((job) => job.id === match.jobId)
  const currentStatus = matchedJob?.status || ''
  const suggestedStatus = classification.suggestedStatus
  const sameStatus = Boolean(suggestedStatus && currentStatus === suggestedStatus)

  return {
    ...message,
    classification: classification.name,
    suggestedStatus,
    confidence: match.confidence,
    jobId: match.jobId,
    candidateJobIds: match.candidateJobIds,
    currentStatus,
    canConfirm: Boolean(suggestedStatus && !sameStatus && (match.confidence === 'strong' || match.confidence === 'possible')),
    statusSuppressed: sameStatus,
    inferredCompany: matchedJob?.company || inferCompanyFromSender(message.from),
    inferredRole: match.confidence === 'strong' ? matchedJob?.role || '' : '',
    emailDate: parseDate(message.date || message.internalDate),
  }
}

export async function getProcessedMessageIds() {
  const stored = await window.chrome.storage.local.get('processedGmailMessageIds')
  return Array.isArray(stored.processedGmailMessageIds) ? stored.processedGmailMessageIds : []
}

export async function markMessageProcessed(messageId) {
  const processedIds = await getProcessedMessageIds()
  if (!processedIds.includes(messageId)) {
    await window.chrome.storage.local.set({ processedGmailMessageIds: [...processedIds, messageId] })
  }
}

export async function unmarkMessageProcessed(messageId) {
  const processedIds = await getProcessedMessageIds()
  await window.chrome.storage.local.set({
    processedGmailMessageIds: processedIds.filter((id) => id !== messageId),
  })
}

export async function scanGmail(token, jobs, processedIds = []) {
  const listResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15', { headers: { Authorization: `Bearer ${token}` } })
  if (listResponse.status === 401) {
    const error = new Error('Gmail authentication expired.')
    error.status = 401
    throw error
  }
  if (!listResponse.ok) throw new Error('Unable to list Gmail messages.')

  const messageList = await listResponse.json()
  const unprocessedMessages = (messageList.messages ?? []).filter((message) => !processedIds.includes(message.id))
  const metadataResults = await Promise.allSettled(unprocessedMessages.map(async (message) => {
    const params = new URLSearchParams({ format: 'metadata' })
    for (const header of ['Subject', 'From', 'Date']) params.append('metadataHeaders', header)
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) {
      const error = new Error('Unable to read message metadata.')
      error.status = response.status
      throw error
    }
    return response.json()
  }))

  if (metadataResults.some((result) => result.status === 'rejected' && result.reason?.status === 401)) {
    const error = new Error('Gmail authentication expired.')
    error.status = 401
    throw error
  }

  return metadataResults.filter((result) => result.status === 'fulfilled').map((result) => result.value).map((message) => {
    const headers = message.payload?.headers ?? []
    const subject = getHeader(headers, 'Subject')
    const from = getHeader(headers, 'From')
    const date = getHeader(headers, 'Date')
    const normalizedFrom = normalizeFrom(from)
    const searchableText = normalizeText(`${subject} ${from}`)
    return {
      id: message.id,
      threadId: message.threadId,
      subject,
      from: normalizedFrom.displayName || normalizedFrom.email,
      date,
      internalDate: message.internalDate,
      likelyJobRelated: jobRelatedSignals.some((signal) => searchableText.includes(normalizeText(signal))),
    }
  }).filter((message) => message.likelyJobRelated).map((message) => buildSuggestion(message, jobs))
}

export function getJobById(jobs, jobId) {
  return jobs.find((job) => job.id === jobId)
}
