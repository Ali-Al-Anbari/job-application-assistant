/**
 * Extracts a job posting from the active page using JobPosting JSON-LD first,
 * then a verified LinkedIn job pane, then a conservative generic page
 * validation path. Generic pages are returned as non-job results when they do
 * not show sufficient hiring evidence.
 *
 * @returns {{ isJobPosting: boolean, confidence: 'high'|'medium'|'low', job: { company: string, role: string, location: string, jobDescription: string, url: string }, validation: object }}
 */
export function extractJobFromPage() {
  function getMetaContent(selector) {
    return document.querySelector(selector)?.getAttribute('content')?.trim() || ''
  }

  function toPlainText(value) {
    if (!value) {
      return ''
    }

    const container = new DOMParser().parseFromString(value, 'text/html')
    const blockElements = new Set([
      'ADDRESS',
      'ARTICLE',
      'DIV',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'LI',
      'P',
      'PRE',
      'SECTION',
      'TR',
    ])

    function collectText(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || ''
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return ''
      }

      if (node.tagName === 'BR') {
        return '\n'
      }

      const text = Array.from(node.childNodes).map(collectText).join('')
      if (node.tagName === 'LI') {
        return `\n• ${text.replace(/\s+/g, ' ').trim()}\n`
      }

      return blockElements.has(node.tagName) ? `\n${text}\n` : text
    }

    return collectText(container.body)
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  function getOrganizationName(organization) {
    if (typeof organization === 'string') {
      return organization.trim()
    }

    return organization?.name?.trim() || ''
  }

  function getLocationText(jobLocation, jobLocationType) {
    const placeholderValues = new Set(['', 'UNAVAILABLE', 'N/A', 'UNKNOWN', 'NOT PROVIDED'])
    const locations = Array.isArray(jobLocation) ? jobLocation : [jobLocation]
    const parts = []

    function addPart(value) {
      const normalized = String(value || '').trim()
      if (
        normalized &&
        !placeholderValues.has(normalized.toUpperCase()) &&
        !parts.some((part) => part.toLowerCase() === normalized.toLowerCase())
      ) {
        parts.push(normalized)
      }
    }

    for (const location of locations) {
      if (typeof location === 'string') {
        addPart(location)
        continue
      }

      const address = location?.address
      if (typeof address === 'string') {
        addPart(address)
        continue
      }

      addPart(address?.addressLocality)
      addPart(address?.addressRegion)
      addPart(address?.addressCountry?.name || address?.addressCountry)
    }

    const isRemote = String(jobLocationType || '').toUpperCase() === 'TELECOMMUTE'
    if (isRemote) {
      return parts.length ? `Remote — ${parts.join(', ')}` : 'Remote'
    }

    return parts.join(', ')
  }

  function findSchemaData(value, schemaTypes = new Set()) {
    if (!value || typeof value !== 'object') {
      return { jobPosting: null, schemaTypes }
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const result = findSchemaData(item, schemaTypes)
        if (result.jobPosting) {
          return result
        }
      }
      return { jobPosting: null, schemaTypes }
    }

    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']]
    types.filter((type) => typeof type === 'string').forEach((type) => schemaTypes.add(type.toLowerCase()))
    if (types.some((type) => type?.toLowerCase() === 'jobposting')) {
      return { jobPosting: value, schemaTypes }
    }

    for (const nestedValue of Object.values(value)) {
      const result = findSchemaData(nestedValue, schemaTypes)
      if (result.jobPosting) {
        return result
      }
    }

    return { jobPosting: null, schemaTypes }
  }

  function getTextElement(root, text) {
    return Array.from(root.querySelectorAll('*')).find(
      (element) => element.textContent?.trim() === text,
    )
  }

  function getLinkedInDescription(pane) {
    const descriptionHeading = getTextElement(pane, 'About the job')
    if (!descriptionHeading) {
      return ''
    }

    const boundaryTexts = [
      'See how you compare to others who clicked apply',
      'About the company',
    ]
    const boundaries = boundaryTexts.map((text) => getTextElement(pane, text)).filter(Boolean)
    const boundary = boundaries.sort((first, second) => {
      const position = first.compareDocumentPosition(second)
      return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    })[0]
    const range = document.createRange()
    range.setStartAfter(descriptionHeading)
    if (boundary) {
      range.setEndBefore(boundary)
    } else {
      range.setEndAfter(pane.lastChild)
    }

    const content = document.createElement('div')
    content.appendChild(range.cloneContents())
    return toPlainText(content.innerHTML)
  }

  function normalizeForMatching(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim()
  }

  function hasExactPhrase(text, phrase) {
    const normalizedText = normalizeForMatching(text)
    const normalizedPhrase = normalizeForMatching(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?:^|\\s)${normalizedPhrase}(?=\\s|$)`, 'i').test(normalizedText)
  }

  function isVisible(element) {
    const style = window.getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
  }

  function getCandidateJobRegion() {
    const anchorPhrases = [
      'apply',
      'apply now',
      'apply for this job',
      'job description',
      'about the role',
      'about the job',
      'responsibilities',
      'qualifications',
      'requirements',
    ]
    const elements = Array.from(document.querySelectorAll('button, a, input[type="submit"], h1, h2, h3, h4, h5, h6'))
    const anchor = elements.find((element) => {
      if (!isVisible(element)) return false
      const text = normalizeForMatching(element.innerText || element.value || element.textContent)
      return anchorPhrases.some((phrase) => text === phrase)
    })

    if (!anchor) return null

    let container = anchor.parentElement
    while (container && container !== document.body) {
      if (/^(ARTICLE|SECTION|MAIN)$/.test(container.tagName) || container.getAttribute('role') === 'main') {
        if ((container.innerText || '').trim().length >= 240) return container
      }
      container = container.parentElement
    }

    return anchor.closest('article, section, main, [role="main"]') || anchor.parentElement
  }

  function getGenericRole(region) {
    const headings = Array.from((region || document).querySelectorAll('h1, h2, h3'))
      .map((heading) => heading.innerText?.trim() || '')
      .filter(Boolean)
    return headings[0] || document.querySelector('h1')?.innerText?.trim() || getMetaContent('meta[property="og:title"]')
  }

  function hasBelievableRole(role) {
    const normalizedRole = normalizeForMatching(role)
    if (!normalizedRole || normalizedRole.length > 120) return false
    if (/^(home|search|careers?|jobs?|products?|about|documentation|messages|inbox|login|sign in)$/i.test(normalizedRole)) return false
    const words = normalizedRole.split(' ')
    const roleWords = /\b(engineer|developer|designer|manager|analyst|scientist|recruiter|coordinator|specialist|consultant|architect|administrator|assistant|associate|officer|representative|technician|director|lead|intern|executive|counsel|nurse|teacher|writer|editor|sales|marketing|finance|operations|product)\b/i
    return words.length > 1 || roleWords.test(normalizedRole)
  }

  function getGenericValidation(role, region, regionText, pageText, hasNonJobSchema) {
    const contentGroups = [
      ['job description', 'about the role', 'about the job', 'responsibilities', "what you'll do", 'what you will do'],
      ['qualifications', 'requirements', 'required qualifications', 'preferred qualifications', 'who you are'],
      ['employment type', 'full-time', 'part-time', 'compensation', 'salary', 'pay range'],
      ['department'],
    ]
    const normalizedRegionText = normalizeForMatching(regionText)
    const matchingGroups = contentGroups.filter((signals) => signals.some((signal) => hasExactPhrase(normalizedRegionText, signal)))
    const actionRoot = region || document.createElement('div')
    const hasActionSignal = Array.from(actionRoot.querySelectorAll('button, a, input[type="submit"]')).some((element) => {
      if (!isVisible(element)) return false
      const text = normalizeForMatching(element.innerText || element.value || element.textContent)
      return ['apply', 'apply now', 'apply for this job', 'submit application', 'submit your application'].includes(text)
    })
    const hasIdentitySignal = ['job id', 'req id', 'requisition id', 'employment type'].some((signal) => hasExactPhrase(normalizedRegionText, signal))
      || ['job id', 'req id', 'requisition id', 'employment type'].some((signal) => hasExactPhrase(pageText, signal))
    const hasApplicationSignal = hasActionSignal || hasIdentitySignal
    const hasSubstantialDescription = regionText.trim().length >= 240
    const hasBelievableTitle = hasBelievableRole(role)
    const passes = !hasNonJobSchema && hasBelievableTitle && hasSubstantialDescription && hasApplicationSignal && matchingGroups.length >= 2

    return {
      source: 'generic',
      hasBelievableTitle,
      hasSubstantialDescription,
      hasApplicationSignal,
      signalGroups: matchingGroups.length,
      nonJobSchemaTypes: hasNonJobSchema.types,
      hasCandidateRegion: Boolean(regionText),
      passed: passes,
    }
  }

  let jobPosting = null
  const schemaTypes = new Set()
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]')

  for (const script of jsonLdScripts) {
    try {
      const schemaData = findSchemaData(JSON.parse(script.textContent || ''), schemaTypes)
      jobPosting = schemaData.jobPosting
    } catch {
      continue
    }

    if (jobPosting) break
  }

  const nonJobSchemaNames = new Set(['softwareapplication', 'mobileapplication', 'product', 'article', 'newsarticle', 'recipe', 'videoobject'])
  const nonJobSchemaTypes = Array.from(schemaTypes).filter((type) => nonJobSchemaNames.has(type))
  const hasNonJobSchema = { types: nonJobSchemaTypes }

  function getGenericDescription() {
    const region = getCandidateJobRegion()
    return {
      region,
      text: region?.innerText?.trim() || '',
    }
  }

  function getGenericJob() {
    const genericContent = getGenericDescription()
    const pageText = document.body.innerText?.trim() || ''
    const role = getGenericRole(genericContent.region)
    const validation = getGenericValidation(role, genericContent.region, genericContent.text, pageText, hasNonJobSchema)
    return {
      job: {
        role,
        company: '',
        location: '',
        jobDescription: genericContent.text,
        url: document.querySelector('link[rel="canonical"]')?.href || window.location.href,
      },
      validation,
    }
  }

  const structuredJob = {
    role: jobPosting?.title?.trim() || '',
    company: getOrganizationName(jobPosting?.hiringOrganization),
    location: getLocationText(jobPosting?.jobLocation, jobPosting?.jobLocationType),
    jobDescription: toPlainText(jobPosting?.description),
    url: jobPosting?.url?.trim() || '',
  }

  const hostname = window.location.hostname.toLowerCase()
  const isLinkedIn = hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')
  const currentJobId = isLinkedIn
    ? new URLSearchParams(window.location.search).get('currentJobId')?.trim()
    : ''
  const linkedinJobUrl = currentJobId
    ? `https://www.linkedin.com/jobs/view/${encodeURIComponent(currentJobId)}`
    : ''
  let linkedinJob = {}
  let hasVerifiedLinkedInJob = false

  if (isLinkedIn && currentJobId) {
    const selectedJobAnchor = document.querySelector(
      `a[href*="/jobs/view/${CSS.escape(currentJobId)}"]`,
    )
    const selectedJobPane = selectedJobAnchor?.closest('[data-testid="lazy-column"]')

    if (selectedJobAnchor && selectedJobPane) {
      hasVerifiedLinkedInJob = true
      const headerLine = selectedJobPane.innerText
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.includes('·'))
      const locationFromHeader = headerLine?.split('·')[0].trim() || ''
      const hasRemoteLocation = /\bremote\b/i.test(headerLine || '')

      linkedinJob = {
        role: selectedJobAnchor.textContent?.trim() || '',
        company: '',
        location: hasRemoteLocation
          ? locationFromHeader
            ? `Remote — ${locationFromHeader}`
            : 'Remote'
          : locationFromHeader,
        jobDescription: getLinkedInDescription(selectedJobPane),
        url: linkedinJobUrl,
      }

      const companyLink = selectedJobPane.querySelector('a[href*="/company/"]')
      linkedinJob.company = companyLink?.textContent?.trim() || ''
    }
  }

  const genericResult = getGenericJob()
  const genericJob = genericResult.job

  const job = {
    role: structuredJob.role || linkedinJob.role || genericJob.role,
    company: structuredJob.company || linkedinJob.company || genericJob.company,
    location: structuredJob.location || linkedinJob.location || genericJob.location,
    jobDescription:
      structuredJob.jobDescription || linkedinJob.jobDescription || genericJob.jobDescription,
    url: linkedinJobUrl || structuredJob.url || linkedinJob.url || genericJob.url,
  }
  const hasStructuredJob = Boolean(jobPosting)
  const isGenericJob = !hasStructuredJob && !hasVerifiedLinkedInJob && genericResult.validation.passed

  return {
    isJobPosting: hasStructuredJob || hasVerifiedLinkedInJob || isGenericJob,
    confidence: hasStructuredJob || hasVerifiedLinkedInJob ? 'high' : isGenericJob ? 'medium' : 'low',
    job,
    validation: hasStructuredJob
      ? { source: 'structured', nonJobSchemaTypes: [] }
      : hasVerifiedLinkedInJob
        ? { source: 'linkedin', passed: true, nonJobSchemaTypes: nonJobSchemaTypes }
        : genericResult.validation,
  }
}
