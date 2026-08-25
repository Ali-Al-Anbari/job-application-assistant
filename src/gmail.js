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

function classifyMessage(subject, from, body = '') {
  const subjectText = normalizeText(`${subject} ${from}`)
  const bodyText = normalizeText(body)
  const interviewRule = classificationRules.find((rule) => rule.name === 'Interview')
  const hasInterviewSignal = interviewRule.signals.some((signal) => subjectText.includes(normalizeText(signal)))

  for (const rule of classificationRules) {
    if (rule.signals.some((signal) => subjectText.includes(normalizeText(signal)))) {
      return { name: rule.name, suggestedStatus: rule.status }
    }
  }

  if (subjectText.includes('next steps') && hasInterviewSignal) {
    return { name: 'Interview', suggestedStatus: 'Interview' }
  }

  for (const rule of classificationRules) {
    if (rule.name === 'Offer') {
      if (rule.signals.some((signal) => bodyText.includes(normalizeText(signal)))) {
        return { name: rule.name, suggestedStatus: rule.status }
      }
      continue
    }

    if (rule.signals.some((signal) => bodyText.includes(normalizeText(signal)))) {
      return { name: rule.name, suggestedStatus: rule.status }
    }
  }

  if (bodyText.includes('next steps') && bodyText.includes('interview')) {
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
  const bodyText = normalizeText(message.bodyText)
  const senderText = normalizeText(`${from.displayName} ${from.email.split('@')[0]}`)
  const candidates = jobs.filter((job) => {
    const company = normalizeCompany(job.company)
    return company && (subjectText.includes(company) || senderText.includes(company) || bodyText.includes(company))
  })

  if (candidates.length === 0) return { confidence: 'none', jobId: '', candidateJobIds: [] }

  const roleMatches = candidates.filter((job) =>
    getRoleTokens(job.role).some((token) => subjectText.includes(token) || bodyText.includes(token)),
  )
  if (roleMatches.length === 1) return { confidence: 'strong', jobId: roleMatches[0].id, candidateJobIds: [roleMatches[0].id] }
  if (candidates.length === 1) return { confidence: 'possible', jobId: candidates[0].id, candidateJobIds: [candidates[0].id] }
  return { confidence: 'ambiguous', jobId: '', candidateJobIds: candidates.map((job) => job.id) }
}

function parseDate(value) {
  const parsed = Date.parse(value || '')
  return Number.isNaN(parsed) ? '' : new Date(parsed).toLocaleDateString('en-CA')
}

export function buildSuggestion(message, jobs) {
  const classification = classifyMessage(message.subject, message.from, message.bodyText)
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

const MAX_BODY_LENGTH = 100000
const BODY_REQUEST_TIMEOUT_MS = 15000

function devLog(...args) {
  if (import.meta.env.DEV) console.debug(...args)
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

function htmlToPlainText(value) {
  const document = new DOMParser().parseFromString(value, 'text/html')
  document.querySelectorAll('script, style').forEach((element) => element.remove())
  const blockTags = new Set(['ADDRESS', 'ARTICLE', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'P', 'PRE', 'SECTION', 'TR'])

  function collectText(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    if (node.tagName === 'BR') return '\n'
    const text = Array.from(node.childNodes).map(collectText).join('')
    if (node.tagName === 'LI') return `\n• ${text.replace(/\s+/g, ' ').trim()}\n`
    return blockTags.has(node.tagName) ? `\n${text}\n` : text
  }

  return collectText(document.body)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isAttachmentPart(part) {
  if (part.body?.attachmentId || part.filename) return true
  return part.headers?.some((header) =>
    header.name?.toLowerCase() === 'content-disposition' &&
    header.value?.toLowerCase().includes('attachment'),
  )
}

function extractBodyText(payload) {
  const plainParts = []
  const htmlParts = []

  devLog('[Gmail] body extraction started', {
    payloadMimeType: payload?.mimeType || '',
    topLevelPartCount: payload?.parts?.length || 0,
  })

  function visit(part) {
    if (!part || isAttachmentPart(part)) return
    const mimeType = part.mimeType?.toLowerCase()
    if (part.body?.data && (mimeType === 'text/plain' || mimeType === 'text/html')) {
      try {
        const decoded = decodeBase64Url(part.body.data)
        if (decoded.trim()) {
          if (mimeType === 'text/plain') plainParts.push(decoded)
          else htmlParts.push(decoded)
        }
      } catch {
        // Ignore malformed body parts and continue with other parts.
      }
    }
    part.parts?.forEach(visit)
  }

  visit(payload)
  const plainText = plainParts.join('\n\n').trim()
  const htmlText = htmlParts.map(htmlToPlainText).filter(Boolean).join('\n\n').trim()
  const text = plainText || htmlText
  devLog('[Gmail] body extraction completed', {
    textLength: text.length,
    truncated: text.length > MAX_BODY_LENGTH,
  })
  return {
    text: text.slice(0, MAX_BODY_LENGTH),
    truncated: text.length > MAX_BODY_LENGTH,
  }
}

async function parseGmailError(response, fallback) {
  let message = fallback
  try {
    const data = await response.json()
    message = data.error?.message || message
  } catch {
    // Keep the fallback message when the error body is unavailable.
  }

  const error = new Error(message)
  error.status = response.status
  error.requiresScope = response.status === 403 && /insufficient|scope|permission denied/i.test(message)
  devLog('[Gmail] API error', { status: error.status, message: error.message })
  return error
}

export async function getMessageBody(token, messageId) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), BODY_REQUEST_TIMEOUT_MS)

  try {
    devLog('[Gmail] full message fetch starting', { messageId })
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
    )
    devLog('[Gmail] full message fetch returned', { messageId, status: response.status })

    devLog('[Gmail] body response', { status: response.status })
    if (!response.ok) {
      throw await parseGmailError(response, 'Unable to read the email body.')
    }

    console.log('POST200: BEFORE JSON')
    const message = await response.json()
    console.log('POST200: JSON PARSED', {
      hasPayload: Boolean(message?.payload),
      mimeType: message?.payload?.mimeType || '',
      parts: message?.payload?.parts?.length ?? 0,
    })
    console.log('POST200: BEFORE EXTRACT')
    const extracted = extractBodyText(message.payload)
    console.log('POST200: EXTRACT RESULT', {
      textLength: extracted?.text?.length ?? 0,
      truncated: Boolean(extracted?.truncated),
    })
    const result = { ...extracted, status: response.status }
    console.log('POST200: RETURNING BODY RESULT', {
      status: result.status,
      textLength: result.text?.length ?? 0,
    })
    return result
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('The Gmail body request timed out.')
      devLog('[Gmail] body request failed', { message: timeoutError.message })
      throw timeoutError
    }
    if (!error.status) {
      devLog('[Gmail] body request failed', { message: error.message || 'Unknown error' })
    }
    if (error.status === 401) {
      error.token = token
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function scanGmail(token, jobs, processedIds = []) {
  const listResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15', { headers: { Authorization: `Bearer ${token}` } })
  if (listResponse.status === 401) {
    const error = new Error('Gmail authentication expired.')
    error.status = 401
    throw error
  }
  if (!listResponse.ok) {
    throw await parseGmailError(listResponse, 'Unable to list Gmail messages.')
  }

  const messageList = await listResponse.json()
  const unprocessedMessages = (messageList.messages ?? []).filter((message) => !processedIds.includes(message.id))
  const metadataResults = await Promise.allSettled(unprocessedMessages.map(async (message) => {
    const params = new URLSearchParams({ format: 'metadata' })
    for (const header of ['Subject', 'From', 'Date']) params.append('metadataHeaders', header)
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) {
      throw await parseGmailError(response, 'Unable to read message metadata.')
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
