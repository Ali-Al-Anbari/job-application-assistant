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

  function findJobPosting(value) {
    if (!value || typeof value !== 'object') {
      return null
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const jobPosting = findJobPosting(item)
        if (jobPosting) {
          return jobPosting
        }
      }
      return null
    }

    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']]
    if (types.some((type) => type?.toLowerCase() === 'jobposting')) {
      return value
    }

    for (const nestedValue of Object.values(value)) {
      const jobPosting = findJobPosting(nestedValue)
      if (jobPosting) {
        return jobPosting
      }
    }

    return null
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

  let jobPosting = null
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]')

  for (const script of jsonLdScripts) {
    try {
      jobPosting = findJobPosting(JSON.parse(script.textContent || ''))
    } catch {
      continue
    }

    if (jobPosting) {
      break
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

  if (isLinkedIn && currentJobId) {
    const selectedJobAnchor = document.querySelector(
      `a[href*="/jobs/view/${CSS.escape(currentJobId)}"]`,
    )
    const selectedJobPane = selectedJobAnchor?.closest('[data-testid="lazy-column"]')

    if (selectedJobAnchor && selectedJobPane) {
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

  const genericJob = {
    role:
      getMetaContent('meta[property="og:title"]') ||
      document.querySelector('h1')?.textContent?.trim() ||
      document.title.trim(),
    company: '',
    location: '',
    jobDescription: toPlainText(
      getMetaContent('meta[property="og:description"]') ||
        getMetaContent('meta[name="description"]'),
    ),
    url: document.querySelector('link[rel="canonical"]')?.href || window.location.href,
  }

  const normalizedUrl = linkedinJobUrl || structuredJob.url || linkedinJob.url || genericJob.url

  return {
    role: structuredJob.role || linkedinJob.role || genericJob.role,
    company: structuredJob.company || linkedinJob.company || genericJob.company,
    location: structuredJob.location || linkedinJob.location || genericJob.location,
    jobDescription:
      structuredJob.jobDescription || linkedinJob.jobDescription || genericJob.jobDescription,
    url: normalizedUrl,
  }
}
