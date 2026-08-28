const classificationRules = [
  {
    name: 'Rejected',
    status: 'Rejected',
    signals: ['decided not to move forward', 'will not be moving forward', 'not moving forward', 'unfortunately', 'other candidates'],
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

/**
 * Determines whether an email has strong newsletter or digest characteristics.
 * Strong evidence requires multiple digest-specific indicators, optionally
 * supported by repeated post/article references.
 *
 * @param {string} subject Email subject text.
 * @param {string} body Email body text; pass an empty string when only metadata is available.
 * @returns {boolean} True when the content is strongly likely to be a digest or newsletter.
 */
export function isDigestLike(subject, body) {
  const text = normalizeText(`${subject} ${body}`)
  const digestSignals = [
    'trending posts',
    'top posts',
    'latest posts',
    'read more',
    'comments',
    'discover your next job',
    'recommended jobs',
    'industry news',
    'career hacks',
    'newsletter',
    'unsubscribe',
    'view online',
    'careers news',
  ]
  const signalCount = digestSignals.filter((signal) => text.includes(normalizeText(signal))).length
  const postMentions = (text.match(/\bpost(?:s)?\b/g) || []).length
  return signalCount >= 3 || (signalCount >= 2 && postMentions >= 2)
}

function hasFirstPersonOfferStatement(subject, body) {
  const text = normalizeText(`${subject} ${body}`)
  return [
    'i accepted the job offer',
    'i got an offer',
    'i received an offer',
    'i recently got an offer',
    'my offer',
  ].some((signal) => text.includes(signal))
}

function hasRecipientDirectedOffer(subject, body) {
  const text = normalizeText(`${subject} ${body}`)
  const explicitOfferPatterns = [
    /(?:we|i)\s+(?:are\s+)?(?:pleased|happy|excited|delighted)\s+to\s+offer\s+you\b/,
    /(?:we|i)\s+would\s+like\s+to\s+offer\s+you\b/,
    /offer\s+you\s+the\s+(?:position|role)\b/,
    /your\s+(?:[a-z0-9]+\s+){0,3}offer\s+letter\b/,
    /offer\s+letter\s+for\s+the\b/,
    /attached\s+is\s+your\s+(?:[a-z0-9]+\s+){0,3}offer\s+letter\b/,
    /employment\s+offer\s+for\s+(?:you|the\s+position|the\s+.{3,80}?\s+position)\b/,
    /congratulations\b.{0,120}\b(?:offer|position)\b/,
  ]
  if (explicitOfferPatterns.some((pattern) => pattern.test(text))) {
    return true
  }

  return /(?:we|i)\s+(?:are\s+)?(?:excited\s+to\s+)?extend\s+an\s+offer\b/.test(text)
    && !hasFirstPersonOfferStatement(subject, body)
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

const excludedCompanyDomains = new Set([
  'gmail',
  'googlemail',
  'outlook',
  'hotmail',
  'yahoo',
  'icloud',
  'greenhouse',
  'lever',
  'workday',
  'workdayjobs',
  'ashby',
  'ashbyhq',
  'smartrecruiters',
  'icims',
  'jobvite',
  'successfactors',
  'taleo',
])

function titleCaseCompany(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((word) => word ? word[0].toUpperCase() + word.slice(1) : word)
    .join(' ')
}

function inferCompanyFromDomain(email) {
  const domain = email.split('@')[1]?.toLowerCase() || ''
  const domainLabel = domain.split('.').filter(Boolean).filter((part) => !['www', 'mail', 'email', 'careers', 'jobs', 'jobs2'].includes(part)).at(0)
  if (!domainLabel || excludedCompanyDomains.has(domainLabel)) {
    return ''
  }

  return titleCaseCompany(domainLabel.replace(/[-_]+/g, ' '))
}

function inferCompanyFromSubject(subject) {
  const patterns = [
    /(?:thank you|thanks) for applying to\s+([^,.;\n]+?)(?:\s+for\b|[,.;\n]|$)/i,
    /your application (?:at|to)\s+([^,.;\n]+?)(?:\s+for\b|[,.;\n]|$)/i,
    /your\s+([^,.;\n]+?)\s+application\b/i,
  ]

  for (const pattern of patterns) {
    const match = String(subject || '').match(pattern)
    const value = match?.[1]?.trim()
    if (value && !excludedCompanyDomains.has(normalizeText(value))) {
      return value
    }
  }

  return ''
}

/**
 * Infers an employer name from explicit subject evidence, sender display text,
 * or a branded sender domain while avoiding ATS and consumer-mail providers.
 * Returns an empty string when the evidence is too weak to name a company.
 *
 * @param {{ from: string, subject?: string }} message Normalized Gmail suggestion data.
 * @returns {string} The inferred company name, or an empty string.
 */
function inferCompany(message) {
  const normalizedFrom = normalizeFrom(message.from)
  const subjectCompany = inferCompanyFromSubject(message.subject)
  if (subjectCompany) {
    return subjectCompany
  }

  const genericNames = /^(google|gmail|notifications?|no reply|noreply|recruiting|recruiter|hiring team|careers|jobs)$/i
  if (normalizedFrom.displayName && !genericNames.test(normalizedFrom.displayName)) {
    return normalizedFrom.displayName
      .replace(/\s+(recruiting|recruitment|hiring|careers?|jobs?|team)\s*$/i, '')
      .trim()
  }

  return inferCompanyFromDomain(normalizedFrom.email)
}

/**
 * Conservatively infers a role from a strong tracked-job match or explicit
 * application-title phrasing in the subject and body. Generic recruiting text
 * without a credible role returns an empty string.
 *
 * @param {{ subject?: string, bodyText?: string }} message Gmail message data.
 * @param {Array<object>} jobs Saved applications used for strong matching.
 * @returns {string} The inferred role, or an empty string.
 */
function inferRoleFromText(message, jobs) {
  const matchedJob = matchMessageToJobs(message, jobs)
  if (matchedJob.confidence === 'strong') {
    return jobs.find((job) => job.id === matchedJob.jobId)?.role || ''
  }

  const text = `${message.subject || ''} ${message.bodyText || ''}`
  const patterns = [
    /(?:your|the)\s+(.{3,80}?)\s+application(?:\s+update|\s+status|\s+for|$)/i,
    /(.{3,80}?)\s+application\s+(?:received|update|status)/i,
  ]

  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1]?.trim()
    if (!value) continue
    const normalizedValue = normalizeText(value)
    if (!normalizedValue || /^(update|update regarding|regarding|confirmation|received)$/.test(normalizedValue)) continue
    if (/\b(application|candidate|career|position|role|team|company)\b$/.test(normalizedValue)) continue
    return value
  }

  return ''
}

/**
 * Classifies a recruiting email into an application stage using deterministic
 * subject, sender, and body signals. Offer classification additionally requires
 * recipient-directed language and excludes first-person third-party statements.
 *
 * @param {string} subject Email subject text.
 * @param {string} from Sender display or email text.
 * @param {string} [body=''] Optional loaded email body text.
 * @returns {{ name: string, suggestedStatus: string }} Classification name and mapped application status.
 */
function classifyMessage(subject, from, body = '') {
  const subjectText = normalizeText(`${subject} ${from}`)
  const bodyText = normalizeText(body)

  for (const rule of classificationRules) {
    if (rule.signals.some((signal) => subjectText.includes(normalizeText(signal)))) {
      return { name: rule.name, suggestedStatus: rule.status }
    }
  }

  for (const rule of classificationRules) {
    if (rule.signals.some((signal) => bodyText.includes(normalizeText(signal)))) {
      return { name: rule.name, suggestedStatus: rule.status }
    }
  }

  if (hasRecipientDirectedOffer(subjectText, bodyText) && !hasFirstPersonOfferStatement(subjectText, bodyText)) {
    return { name: 'Offer', suggestedStatus: 'Offer' }
  }

  return { name: 'Unknown', suggestedStatus: '' }
}

function getRoleTokens(role) {
  return normalizeText(role).split(' ').filter((token) => token.length > 2 && !['and', 'the', 'for', 'with'].includes(token))
}

/**
 * Matches a Gmail message to saved applications using company evidence in the
 * subject, sender, or body and role tokens in the subject or body.
 * Ambiguous company matches leave jobId empty and expose candidateJobIds.
 *
 * @param {{ subject?: string, from?: string, bodyText?: string }} message Gmail message data.
 * @param {Array<object>} jobs Saved applications to match against.
 * @returns {{ confidence: 'none'|'strong'|'possible'|'ambiguous', jobId: string, candidateJobIds: string[] }}
 */
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

/**
 * Builds the dashboard-facing review suggestion by combining classification,
 * application matching, inferred fields, current status, and email date.
 * The returned object preserves the original message fields.
 *
 * @param {object} message Normalized Gmail message data.
 * @param {Array<object>} jobs Saved applications used for matching.
 * @returns {object} Review suggestion with classification, matching, and inference fields.
 */
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
    inferredCompany: matchedJob?.company || inferCompany(message),
    inferredRole: match.confidence === 'strong' ? matchedJob?.role || '' : inferRoleFromText(message, jobs),
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

/**
 * Extracts readable plain text from a Gmail message payload by traversing MIME
 * parts, skipping attachments, decoding text parts, and limiting the result to
 * MAX_BODY_LENGTH.
 *
 * @param {object} payload Gmail message payload.
 * @returns {{ text: string, truncated: boolean }} Extracted text and truncation state.
 */
function extractBodyText(payload) {
  const plainParts = []
  const htmlParts = []


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
  return error
}

/**
 * Fetches one Gmail message with format=full and returns its extracted readable
 * body. The request is bounded by a timeout, and the raw message payload is not
 * returned or persisted.
 *
 * @param {string} token OAuth access token for the Gmail API request.
 * @param {string} messageId Gmail message ID.
 * @returns {Promise<{ text: string, truncated: boolean, status: number }>} Extracted body result.
 */
export async function getMessageBody(token, messageId) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), BODY_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
    )
    if (!response.ok) {
      throw await parseGmailError(response, 'Unable to read the email body.')
    }

    const message = await response.json()
    const extracted = extractBodyText(message.payload)
    return { ...extracted, status: response.status }
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('The Gmail body request timed out.')
      throw timeoutError
    }
    if (error.status === 401) {
      error.token = token
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Scans Gmail messages from the last seven days, excludes processed message IDs
 * before metadata requests, keeps metadata-only bulk fetching, and builds
 * suggestions only for messages that pass the cheap relevance filter.
 * Full bodies are not fetched during scanning.
 *
 * @param {string} token OAuth access token for Gmail API requests.
 * @param {Array<object>} jobs Saved applications used to build suggestions.
 * @param {string[]} [processedIds=[]] Previously handled Gmail message IDs.
 * @returns {Promise<Array<object>>} Metadata-built Gmail review suggestions.
 */
export async function scanGmail(token, jobs, processedIds = []) {
  const params = new URLSearchParams({
    maxResults: '50',
    q: 'newer_than:7d',
  })
  const listResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, { headers: { Authorization: `Bearer ${token}` } })
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
      likelyJobRelated: !isDigestLike(subject, '') && jobRelatedSignals.some((signal) => searchableText.includes(normalizeText(signal))),
    }
  }).filter((message) => message.likelyJobRelated).map((message) => buildSuggestion(message, jobs))
}

export function getJobById(jobs, jobId) {
  return jobs.find((job) => job.id === jobId)
}
