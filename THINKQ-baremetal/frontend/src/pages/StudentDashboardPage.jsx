import { useEffect, useMemo, useRef, useState } from 'react'
import AppHeader from '../components/AppHeader'
import StarRating from '../components/StarRating'
import { createTicket, deleteTicket, getMyTickets, getQueueMetrics, getTicketLookups, submitTicketFeedback } from '../lib/api'

const ISSUE_TYPES = [
  { value: 'HOMEWORK', label: 'Homework' },
  { value: 'LAB', label: 'Lab' },
  { value: 'PROJECT', label: 'Project' },
  { value: 'EXAM_REVIEW', label: 'Exam Review' },
  { value: 'GENERAL', label: 'General' }
]

function formatDateTime(value) {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleString()
}

function buildUniqueBuildings(locations) {
  const seen = new Map()
  locations.forEach(function(location) {
    if (!location || !location.buildingId) {
      return
    }
    if (!seen.has(String(location.buildingId))) {
      seen.set(String(location.buildingId), {
        id: String(location.buildingId),
        name: location.buildingName
      })
    }
  })
  return Array.from(seen.values()).sort(function(a, b) {
    return a.name.localeCompare(b.name)
  })
}

function buildUniqueRooms(locations, buildingId) {
  const seen = new Map()
  locations.forEach(function(location) {
    if (String(location.buildingId) !== String(buildingId) || !location.roomId) {
      return
    }
    if (!seen.has(String(location.roomId))) {
      seen.set(String(location.roomId), {
        id: String(location.roomId),
        name: location.roomName,
        displayLabel: `${location.buildingName} / Room ${location.roomName}`
      })
    }
  })
  return Array.from(seen.values()).sort(function(a, b) {
    return a.name.localeCompare(b.name)
  })
}

export default function StudentDashboardPage({ user }) {
  const [lookups, setLookups] = useState({ courses: [], locations: [] })
  const [tickets, setTickets] = useState([])
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [form, setForm] = useState({
    subject: '',
    courseId: '',
    buildingId: '',
    roomId: '',
    locationId: '',
    issueType: 'GENERAL',
    notes: '',
    preferredContact: 'QUEUE_DISPLAY'
  })
  const [feedbackDrafts, setFeedbackDrafts] = useState({})
  const [feedbackPopupTicket, setFeedbackPopupTicket] = useState(null)
  const [isHelpSheetOpen, setIsHelpSheetOpen] = useState(false)
  const [queueCount, setQueueCount] = useState(null)

  const activeTicket = useMemo(function() {
    return tickets.find(function(ticket) {
      return ticket.status === 'IN_QUEUE' || ticket.status === 'ASSIGNED'
    })
  }, [tickets])

  const countedBuildingId = String(activeTicket && activeTicket.roomId ? activeTicket.buildingId : form.buildingId || '')
  const countedRoomId = String(activeTicket && activeTicket.roomId ? activeTicket.roomId : form.roomId || '')
  const queueScopeRef = useRef({ buildingId: '', roomId: '' })
  queueScopeRef.current = { buildingId: countedBuildingId, roomId: countedRoomId }

  const groupedSubjects = useMemo(function() {
    const map = new Map()
    lookups.courses.forEach(function(course) {
      const subject = String(course.subject || '').toUpperCase()
      if (!map.has(subject)) {
        map.set(subject, [])
      }
      map.get(subject).push(course)
    })

    let result = Array.from(map.entries()).map(function(entry) {
      const subject = entry[0]
      const courses = entry[1].slice().sort(function(a, b) {
        return `${a.subject}${a.code}`.localeCompare(`${b.subject}${b.code}`)
      })
      return { subject, courses }
    }).sort(function(a, b) {
      return a.subject.localeCompare(b.subject)
    })

    const term = searchValue.trim().toLowerCase()
    if (term) {
      result = result.filter(function(item) {
        return item.subject.toLowerCase().includes(term) || item.courses.some(function(course) {
          return course.code.toLowerCase().includes(term) || String(course.title || '').toLowerCase().includes(term)
        })
      })
    }

    return result
  }, [lookups.courses, searchValue])

  const selectedCourses = useMemo(function() {
    return lookups.courses.filter(function(course) {
      return String(course.subject).toUpperCase() === String(form.subject).toUpperCase()
    }).sort(function(a, b) {
      return `${a.subject}${a.code}`.localeCompare(`${b.subject}${b.code}`)
    })
  }, [lookups.courses, form.subject])

  const availableBuildings = useMemo(function() {
    return buildUniqueBuildings(lookups.locations)
  }, [lookups.locations])

  const availableRooms = useMemo(function() {
    return buildUniqueRooms(lookups.locations, form.buildingId)
  }, [lookups.locations, form.buildingId])

  const availableTables = useMemo(function() {
    return lookups.locations.filter(function(location) {
      return String(location.roomId) === String(form.roomId)
    }).slice().sort(function(a, b) {
      return String(a.tableNumber).localeCompare(String(b.tableNumber), undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [lookups.locations, form.roomId])

  async function refreshAll() {
    const [lookupData, myTickets] = await Promise.all([
      getTicketLookups(),
      getMyTickets()
    ])

    setLookups(lookupData)
    setTickets(myTickets)
  }

  function refreshQueueCount() {
    const scope = queueScopeRef.current
    if (!scope.buildingId || !scope.roomId) {
      setQueueCount(null)
      return
    }
    getQueueMetrics({ buildingId: scope.buildingId, roomId: scope.roomId }).then(function(metrics) {
      setQueueCount(metrics.queueCount)
    }).catch(function() {})
  }

  useEffect(function() {
    refreshAll().catch(function(error) {
      setMessage(error.message || 'Failed to load student workspace.')
    })
  }, [])

  useEffect(function() {
    refreshQueueCount()
  }, [countedBuildingId, countedRoomId])

  useEffect(function() {
    if (!countedBuildingId || !countedRoomId) {
      return
    }

    const queueStream = new EventSource(`/events/queue?buildingId=${countedBuildingId}&roomId=${countedRoomId}`)

    function handleMetrics(event) {
      try {
        const metrics = JSON.parse(event.data)
        if (metrics && typeof metrics.queueCount === 'number') {
          setQueueCount(metrics.queueCount)
        }
      } catch (error) {
      }
    }

    queueStream.addEventListener('queueMetrics', handleMetrics)

    return function() {
      queueStream.close()
    }
  }, [countedBuildingId, countedRoomId])

  useEffect(function() {
    if (!isHelpSheetOpen) {
      return
    }
    document.body.classList.add('sheet-lock')
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsHelpSheetOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return function() {
      document.body.classList.remove('sheet-lock')
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isHelpSheetOpen])

  useEffect(function() {
    const stream = new EventSource('/events/students/' + user.id)

    stream.addEventListener('studentNotification', function(event) {
      const payload = JSON.parse(event.data)
      setMessage(payload.message || 'Your ticket was updated.')
      refreshAll().catch(function() {})
      refreshQueueCount()
    })

    stream.addEventListener('feedbackRequested', function(event) {
      const payload = JSON.parse(event.data)
      const ticket = payload.ticket
      setMessage(`Feedback is now ready for ${ticket.courseLabel}.`)
      setFeedbackDrafts(function(previous) {
        if (previous[ticket.id]) {
          return previous
        }
        return { ...previous, [ticket.id]: { rating: '0', comment: '' } }
      })
      setFeedbackPopupTicket(ticket)
      refreshAll().catch(function() {})
      refreshQueueCount()
    })

    return function() {
      stream.close()
    }
  }, [user.id])

  useEffect(function() {
    if (!form.subject) {
      return
    }
    const exists = selectedCourses.some(function(course) {
      return String(course.id) === String(form.courseId)
    })
    if (!exists && form.courseId) {
      setForm(function(previous) {
        return {
          ...previous,
          courseId: ''
        }
      })
    }
  }, [form.subject, form.courseId, selectedCourses])

  useEffect(function() {
    const exists = availableBuildings.some(function(building) {
      return String(building.id) === String(form.buildingId)
    })
    if (!exists) {
      setForm(function(previous) {
        return {
          ...previous,
          buildingId: availableBuildings[0] ? String(availableBuildings[0].id) : ''
        }
      })
    }
  }, [availableBuildings, form.buildingId])

  useEffect(function() {
    const exists = availableRooms.some(function(room) {
      return String(room.id) === String(form.roomId)
    })
    if (!exists) {
      setForm(function(previous) {
        return {
          ...previous,
          roomId: availableRooms[0] ? String(availableRooms[0].id) : ''
        }
      })
    }
  }, [availableRooms, form.roomId])

  useEffect(function() {
    const exists = availableTables.some(function(location) {
      return String(location.id) === String(form.locationId)
    })
    if (!exists) {
      setForm(function(previous) {
        return {
          ...previous,
          locationId: availableTables[0] ? String(availableTables[0].id) : ''
        }
      })
    }
  }, [availableTables, form.locationId])

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setMessage('')
    try {
      await createTicket({
        courseId: Number(form.courseId),
        locationId: Number(form.locationId),
        issueType: form.issueType,
        notes: form.notes,
        preferredContact: form.preferredContact
      })
      await refreshAll()
      refreshQueueCount()
      setForm(function(previous) {
        return {
          ...previous,
          issueType: 'GENERAL',
          notes: ''
        }
      })
      setIsHelpSheetOpen(false)
      setMessage('Your ticket has been added to the queue.')
    } catch (error) {
      setMessage(error.message || 'Unable to create ticket.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteTicket(ticketId) {
    if (!window.confirm('Delete this help request? This cannot be undone.')) {
      return
    }
    try {
      await deleteTicket(ticketId)
      await refreshAll()
      refreshQueueCount()
      setMessage('Your help request was deleted.')
    } catch (error) {
      setMessage(error.message || 'Unable to delete ticket.')
    }
  }

  async function handleFeedback(ticketId) {
    const draft = feedbackDrafts[ticketId] || { rating: '0', comment: '' }
    const rating = Number(draft.rating || 0)
    if (!rating) {
      setMessage('Pick a star rating before submitting feedback.')
      return
    }
    try {
      await submitTicketFeedback(ticketId, {
        rating,
        comment: draft.comment || ''
      })
      setMessage('Feedback submitted successfully.')
      setFeedbackPopupTicket(null)
      await refreshAll()
    } catch (error) {
      setMessage(error.message || 'Unable to submit feedback.')
    }
  }

  return (
    <div className="dashboard-screen app-dashboard-shell">
      <AppHeader
        title={`Welcome ${user.name}`}
        subtitle=""
        queueCount={queueCount}
      />

      {message ? <div className="inline-status-message page-status-message">{message}</div> : null}

      <div className="student-dashboard-grid">
        <section className={isHelpSheetOpen ? 'dashboard-card form-card mobile-sheet sheet-open' : 'dashboard-card form-card mobile-sheet'}>
          <div className="sheet-head">
            <span className="sheet-grabber" aria-hidden="true" />
            <button className="sheet-close" type="button" aria-label="Close help form" onClick={function() { setIsHelpSheetOpen(false) }}>×</button>
          </div>

          <div className="card-heading-row">
            <div>
              <span className="card-eyebrow">Student Support Request</span>
              <h2>Create ticket</h2>
            </div>
          </div>

          {activeTicket ? (
            <div className="form-lock-notice">
              You already have an open help request for {activeTicket.courseLabel}. Delete it with the × on its card, or wait until a tutor completes it, before submitting another one.
            </div>
          ) : null}

          <form className="ticket-form" onSubmit={handleSubmit}>
            <label className="field-block">
              <span>Building</span>
              <select value={form.buildingId} onChange={function(event) { setForm({ ...form, buildingId: event.target.value, roomId: '', locationId: '' }) }} required>
                {availableBuildings.map(function(building) {
                  return <option key={building.id} value={building.id}>{building.name}</option>
                })}
              </select>
            </label>

            <label className="field-block">
              <span>Room</span>
              <select value={form.roomId} onChange={function(event) { setForm({ ...form, roomId: event.target.value, locationId: '' }) }} required>
                {availableRooms.map(function(room) {
                  return <option key={room.id} value={room.id}>{room.name}</option>
                })}
              </select>
            </label>

            <label className="field-block">
              <span>Table</span>
              <select value={form.locationId} onChange={function(event) { setForm({ ...form, locationId: event.target.value }) }} required>
                {availableTables.map(function(location) {
                  return <option key={location.id} value={location.id}>Table {location.tableNumber}</option>
                })}
              </select>
            </label>

            <label className="field-block">
              <span>Subject <span className="field-required">*</span></span>
              <select value={form.subject} onChange={function(event) { setForm({ ...form, subject: event.target.value, courseId: '' }) }} required>
                <option value="">Select subject</option>
                {groupedSubjects.map(function(item) {
                  return <option key={item.subject} value={item.subject}>{item.subject}</option>
                })}
              </select>
            </label>

            <label className="field-block">
              <span>Subject code <span className="field-required">*</span></span>
              <select value={form.courseId} onChange={function(event) { setForm({ ...form, courseId: event.target.value }) }} required>
                <option value="">Select subject code</option>
                {selectedCourses.map(function(course) {
                  return <option key={course.id} value={course.id}>{course.subject}{course.code} — {course.title}</option>
                })}
              </select>
            </label>

            <label className="field-block">
              <span>Help topic</span>
              <select value={form.issueType} onChange={function(event) { setForm({ ...form, issueType: event.target.value }) }}>
                {ISSUE_TYPES.map(function(item) {
                  return <option key={item.value} value={item.value}>{item.label}</option>
                })}
              </select>
            </label>

            <label className="field-block field-block-wide">
              <span>Notes</span>
              <textarea value={form.notes} onChange={function(event) { setForm({ ...form, notes: event.target.value }) }} placeholder="Tell the tutor what you need help with." />
            </label>

            <button className="help-button field-block-wide" type="submit" disabled={isSaving || Boolean(activeTicket) || !form.locationId || !form.subject || !form.courseId}>
              {isSaving ? 'Submitting...' : 'Help Me'}
            </button>
          </form>
        </section>

        <section className="dashboard-card queue-card">
          <div className="card-heading-row queue-heading-row">
            <div>
              <span className="card-eyebrow">Queue Screen</span>
              <h2>Your queue activity</h2>
            </div>
          </div>

          <div className="queue-list">
            {tickets.length === 0 ? <div className="queue-empty-state">No tickets yet. Submit a request to join the support queue.</div> : null}
            {tickets.map(function(ticket) {
              const needsFeedback = ticket.status === 'COMPLETED' && !ticket.rating
              const draft = feedbackDrafts[ticket.id] || { rating: '0', comment: '' }

              return (
                <article className="queue-ticket-card" key={ticket.id}>
                  {ticket.status !== 'COMPLETED' ? (
                    <button
                      className="ticket-delete-button"
                      type="button"
                      aria-label="Delete this ticket"
                      title="Delete this ticket"
                      onClick={function() { handleDeleteTicket(ticket.id) }}
                    >
                      ×
                    </button>
                  ) : null}
                  <div className="queue-ticket-topline">
                    <strong>{ticket.courseLabel}</strong>
                    <span className={`ticket-status status-${String(ticket.status).toLowerCase()}`}>{ticket.status.replace('_', ' ')}</span>
                  </div>
                  <div className="queue-ticket-meta">
                    <span>{ticket.locationLabel}</span>
                    <span>{ticket.issueType.replace('_', ' ')}</span>
                    <span>Created {formatDateTime(ticket.createdAt)}</span>
                  </div>
                  {ticket.notes ? <p className="ticket-note">{ticket.notes}</p> : null}
                  {ticket.teacherName ? <div className="queue-ticket-assignee">Accepted by <strong>{ticket.teacherName}</strong></div> : null}
                  {ticket.feedbackComment ? <div className="queue-ticket-feedback">Your feedback: {ticket.rating}/5 — {ticket.feedbackComment}</div> : null}

                  {needsFeedback ? (
                    <div className="feedback-panel">
                      <div className="feedback-panel-title">Feedback requested</div>
                      <div className="feedback-grid">
                        <div className="field-block">
                          <span>Rating</span>
                          <StarRating
                            value={draft.rating}
                            idPrefix={`ticket-${ticket.id}`}
                            onChange={function(nextRating) {
                              setFeedbackDrafts(function(previous) {
                                const current = previous[ticket.id] || { rating: '0', comment: '' }
                                return { ...previous, [ticket.id]: { ...current, rating: String(nextRating) } }
                              })
                            }}
                          />
                        </div>
                        <label className="field-block field-block-wide">
                          <span>Comment</span>
                          <textarea value={draft.comment} onChange={function(event) {
                            const nextValue = event.target.value
                            setFeedbackDrafts(function(previous) {
                              const current = previous[ticket.id] || { rating: '0', comment: '' }
                              return { ...previous, [ticket.id]: { ...current, comment: nextValue } }
                            })
                          }} placeholder="How was your help session?" />
                        </label>
                        <button className="secondary-action-button" type="button" disabled={!Number(draft.rating)} onClick={function() { handleFeedback(ticket.id) }}>Submit feedback</button>
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>
      </div>

      {isHelpSheetOpen ? (
        <div className="mobile-sheet-backdrop" role="presentation" onClick={function() { setIsHelpSheetOpen(false) }} />
      ) : null}

      <div className="mobile-fab-row">
        <button className="mobile-fab fab-help" type="button" onClick={function() { setIsHelpSheetOpen(true) }}>
          <span className="fab-emoji" aria-hidden="true">🙋</span>
          <span className="fab-label">Ask for help</span>
        </button>
      </div>

      {feedbackPopupTicket ? (
        <div className="feedback-popup-backdrop" role="presentation">
          <div className="feedback-popup-card" role="dialog" aria-modal="true" aria-labelledby="feedbackPopupTitle">
            <div className="feedback-popup-header">
              <div>
                <span className="card-eyebrow">Feedback Requested</span>
                <h2 id="feedbackPopupTitle">How was your help session?</h2>
              </div>
              <button className="feedback-popup-close" type="button" onClick={function() { setFeedbackPopupTicket(null) }} aria-label="Close feedback popup">
                ×
              </button>
            </div>
            <p className="feedback-popup-copy">
              {feedbackPopupTicket.teacherName ? `${feedbackPopupTicket.teacherName} marked your ${feedbackPopupTicket.courseLabel} ticket as complete.` : `Your ${feedbackPopupTicket.courseLabel} ticket was marked complete.`} Please rate your experience.
            </p>
            <div className="feedback-grid">
              <div className="field-block">
                <span>Rating</span>
                <StarRating
                  value={(feedbackDrafts[feedbackPopupTicket.id] || { rating: '0', comment: '' }).rating}
                  idPrefix={`popup-${feedbackPopupTicket.id}`}
                  onChange={function(nextRating) {
                    setFeedbackDrafts(function(previous) {
                      const current = previous[feedbackPopupTicket.id] || { rating: '0', comment: '' }
                      return { ...previous, [feedbackPopupTicket.id]: { ...current, rating: String(nextRating) } }
                    })
                  }}
                />
              </div>
              <label className="field-block field-block-wide">
                <span>Comment</span>
                <textarea value={(feedbackDrafts[feedbackPopupTicket.id] || { rating: '0', comment: '' }).comment} onChange={function(event) {
                  const nextValue = event.target.value
                  setFeedbackDrafts(function(previous) {
                    const current = previous[feedbackPopupTicket.id] || { rating: '0', comment: '' }
                    return { ...previous, [feedbackPopupTicket.id]: { ...current, comment: nextValue } }
                  })
                }} placeholder="Tell us about the support you received." />
              </label>
            </div>
            <div className="feedback-popup-actions">
              <button className="secondary-action-button" type="button" onClick={function() { setFeedbackPopupTicket(null) }}>
                Later
              </button>
              <button className="help-button" type="button" disabled={!Number((feedbackDrafts[feedbackPopupTicket.id] || { rating: '0', comment: '' }).rating)} onClick={function() { handleFeedback(feedbackPopupTicket.id) }}>
                Submit feedback
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  )
}
