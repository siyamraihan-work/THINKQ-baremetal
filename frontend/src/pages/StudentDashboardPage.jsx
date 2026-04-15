import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import { createTicket, getMyTickets, getQueueMetrics, getTicketLookups, submitTicketFeedback } from '../lib/api'

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

function waitLabel(metrics) {
  if (!metrics || metrics.onlineTeacherCount === 0) {
    return 'Unavailable'
  }
  return `${metrics.estimatedWaitMinutes} min`
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
  const [metrics, setMetrics] = useState(null)
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

    if (!form.subject && lookupData.courses.length > 0) {
      const firstCourse = lookupData.courses.slice().sort(function(a, b) {
        return `${a.subject}${a.code}`.localeCompare(`${b.subject}${b.code}`)
      })[0]
      setForm(function(previous) {
        return {
          ...previous,
          subject: firstCourse.subject,
          courseId: String(firstCourse.id)
        }
      })
    }
  }

  useEffect(function() {
    refreshAll().catch(function(error) {
      setMessage(error.message || 'Failed to load student workspace.')
    })
  }, [])

  useEffect(function() {
    const stream = new EventSource('/events/students/' + user.id)

    stream.addEventListener('studentNotification', function(event) {
      const payload = JSON.parse(event.data)
      setMessage(payload.message || 'Your ticket was updated.')
      refreshAll().catch(function() {})
    })

    stream.addEventListener('feedbackRequested', function(event) {
      const payload = JSON.parse(event.data)
      const ticket = payload.ticket
      setMessage(`Feedback is now ready for ${ticket.courseLabel}.`)
      setFeedbackDrafts(function(previous) {
        if (previous[ticket.id]) {
          return previous
        }
        return { ...previous, [ticket.id]: { rating: '5', comment: '' } }
      })
      setFeedbackPopupTicket(ticket)
      refreshAll().catch(function() {})
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
    if (!exists) {
      setForm(function(previous) {
        return {
          ...previous,
          courseId: selectedCourses[0] ? String(selectedCourses[0].id) : ''
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

  useEffect(function() {
    if (!form.buildingId || !form.roomId) {
      return
    }

    getQueueMetrics({ buildingId: form.buildingId, roomId: form.roomId }).then(function(metricData) {
      setMetrics(metricData)
    }).catch(function(error) {
      setMessage(error.message || 'Unable to load room metrics.')
    })
  }, [form.buildingId, form.roomId])

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
      setForm(function(previous) {
        return {
          ...previous,
          issueType: 'GENERAL',
          notes: ''
        }
      })
      setMessage('Your ticket has been added to the queue.')
    } catch (error) {
      setMessage(error.message || 'Unable to create ticket.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleFeedback(ticketId) {
    const draft = feedbackDrafts[ticketId] || { rating: '5', comment: '' }
    try {
      await submitTicketFeedback(ticketId, {
        rating: Number(draft.rating || 5),
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
      />

      <div className="student-dashboard-grid">
        <section className="dashboard-card form-card">
          <div className="card-heading-row">
            <div>
              <span className="card-eyebrow">Student Support Request</span>
              <h2>Create ticket</h2>
            </div>
          </div>

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
              <span>Subject</span>
              <select value={form.subject} onChange={function(event) { setForm({ ...form, subject: event.target.value, courseId: '' }) }} required>
                {groupedSubjects.map(function(item) {
                  return <option key={item.subject} value={item.subject}>{item.subject}</option>
                })}
              </select>
            </label>

            <label className="field-block">
              <span>Subject code</span>
              <select value={form.courseId} onChange={function(event) { setForm({ ...form, courseId: event.target.value }) }} required>
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

            <button className="help-button field-block-wide" type="submit" disabled={isSaving || !form.locationId || !form.courseId}>
              {isSaving ? 'Submitting...' : 'Help Me'}
            </button>
          </form>

          {message ? <div className="inline-status-message">{message}</div> : null}
        </section>

        <section className="dashboard-card queue-card">
          <div className="card-heading-row queue-heading-row">
            <div>
              <span className="card-eyebrow">Queue Screen</span>
              <h2>Your queue activity</h2>
            </div>
            <div className="queue-metrics-bar compact-metrics-bar">
              <div className="metric-pill metric-pill-compact">
                <span className="metric-label">Tutors online</span>
                <strong>{metrics?.onlineTeacherCount ?? '—'}</strong>
              </div>
              <div className="metric-pill metric-pill-compact">
                <span className="metric-label">Estimated wait</span>
                <strong>{waitLabel(metrics)}</strong>
              </div>
            </div>
          </div>

          <div className="queue-list">
            {tickets.length === 0 ? <div className="queue-empty-state">No tickets yet. Submit a request to join the support queue.</div> : null}
            {tickets.map(function(ticket) {
              const needsFeedback = ticket.status === 'COMPLETED' && !ticket.rating
              const draft = feedbackDrafts[ticket.id] || { rating: '5', comment: '' }

              return (
                <article className="queue-ticket-card" key={ticket.id}>
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
                        <label className="field-block">
                          <span>Rating</span>
                          <select value={draft.rating} onChange={function(event) {
                            setFeedbackDrafts(function(previous) {
                              return { ...previous, [ticket.id]: { ...draft, rating: event.target.value } }
                            })
                          }}>
                            {[5, 4, 3, 2, 1].map(function(value) {
                              return <option key={value} value={value}>{value}</option>
                            })}
                          </select>
                        </label>
                        <label className="field-block field-block-wide">
                          <span>Comment</span>
                          <textarea value={draft.comment} onChange={function(event) {
                            setFeedbackDrafts(function(previous) {
                              return { ...previous, [ticket.id]: { ...draft, comment: event.target.value } }
                            })
                          }} placeholder="How was your help session?" />
                        </label>
                        <button className="secondary-action-button" type="button" onClick={function() { handleFeedback(ticket.id) }}>Submit feedback</button>
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>
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
              <label className="field-block">
                <span>Rating</span>
                <select value={(feedbackDrafts[feedbackPopupTicket.id] || { rating: '5', comment: '' }).rating} onChange={function(event) {
                  const nextValue = event.target.value
                  setFeedbackDrafts(function(previous) {
                    const current = previous[feedbackPopupTicket.id] || { rating: '5', comment: '' }
                    return { ...previous, [feedbackPopupTicket.id]: { ...current, rating: nextValue } }
                  })
                }}>
                  {[5, 4, 3, 2, 1].map(function(value) {
                    return <option key={value} value={value}>{value}</option>
                  })}
                </select>
              </label>
              <label className="field-block field-block-wide">
                <span>Comment</span>
                <textarea value={(feedbackDrafts[feedbackPopupTicket.id] || { rating: '5', comment: '' }).comment} onChange={function(event) {
                  const nextValue = event.target.value
                  setFeedbackDrafts(function(previous) {
                    const current = previous[feedbackPopupTicket.id] || { rating: '5', comment: '' }
                    return { ...previous, [feedbackPopupTicket.id]: { ...current, comment: nextValue } }
                  })
                }} placeholder="Tell us about the support you received." />
              </label>
            </div>
            <div className="feedback-popup-actions">
              <button className="secondary-action-button" type="button" onClick={function() { setFeedbackPopupTicket(null) }}>
                Later
              </button>
              <button className="help-button" type="button" onClick={function() { handleFeedback(feedbackPopupTicket.id) }}>
                Submit feedback
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  )
}
