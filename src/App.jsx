import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import { extractJobFromPage } from './extractJobFromPage.js'
import './App.css'

function getDescriptionPreview(description) {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' })
    const sentences = Array.from(segmenter.segment(description), ({ segment }) => segment)

    return {
      text: sentences.slice(0, 2).join('').trim(),
      hasMore: sentences.length > 2,
    }
  }

  const sentences = description.match(/.*?(?:[.!?](?=\s|$)|$)/g)?.filter(Boolean) || []
  return {
    text: sentences.slice(0, 2).join('').trim() || description,
    hasMore: sentences.length > 2,
  }
}

function App() {
  const [count, setCount] = useState(0)
  const [extraction, setExtraction] = useState({ loading: true, job: null, error: '' })
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const openDashboard = () => {
    window.chrome.tabs.create({
      url: window.chrome.runtime.getURL('dashboard.html'),
    })
  }

  useEffect(() => {
    async function extractFromActiveTab() {
      try {
        const [tab] = await window.chrome.tabs.query({
          active: true,
          currentWindow: true,
        })

        if (!tab?.id || !tab.url || /^(chrome|edge|about|devtools):/.test(tab.url)) {
          throw new Error('This page cannot be inspected.')
        }

        const [result] = await window.chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractJobFromPage,
        })

        setExtraction({ loading: false, job: result?.result || null, error: '' })
        setIsDescriptionExpanded(false)
      } catch {
        setExtraction({
          loading: false,
          job: null,
          error: 'Unable to extract job details from this page.',
        })
        setIsDescriptionExpanded(false)
      }
    }

    extractFromActiveTab()
  }, [])

  return (
    <>
      <section id="center">
        <section className="extraction-panel" aria-live="polite">
          <h2>Current Job Posting</h2>
          {extraction.loading && <p>Reading this page...</p>}
          {extraction.error && <p className="extraction-error">{extraction.error}</p>}
          {extraction.job && (
            <dl>
              <div>
                <dt>Role</dt>
                <dd>{extraction.job.role || 'Not found'}</dd>
              </div>
              <div>
                <dt>Company</dt>
                <dd>{extraction.job.company || 'Not found'}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{extraction.job.location || 'Not found'}</dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd>
                  {extraction.job.jobDescription ? (
                    (() => {
                      const descriptionPreview = getDescriptionPreview(
                        extraction.job.jobDescription,
                      )
                      return (
                        <>
                          {isDescriptionExpanded
                            ? extraction.job.jobDescription
                            : descriptionPreview.text}
                          {descriptionPreview.hasMore && (
                            <button
                              type="button"
                              className="description-toggle"
                              onClick={() =>
                                setIsDescriptionExpanded((expanded) => !expanded)
                              }
                            >
                              {isDescriptionExpanded ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </>
                      )
                    })()
                  ) : (
                    'Not found'
                  )}
                </dd>
              </div>
              <div>
                <dt>URL</dt>
                <dd>{extraction.job.url || 'Not found'}</dd>
              </div>
            </dl>
          )}
        </section>
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.jsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button
          type="button"
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
        <button type="button" onClick={openDashboard}>
          Open Dashboard
        </button>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
