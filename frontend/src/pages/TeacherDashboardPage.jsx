import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import {
  acceptTicket,
  clearTeacherActiveRoom,
  completeTicket,
  getMyTickets,
  getQueueMetrics,
  getQueueTickets,
  getTeacherActiveRoom,
  getTicketLookups,
  heartbeatTeacherActiveRoom,
  setTeacherActiveRoom
} from '../lib/api'

function waitLabel(metrics) {
  if (!metrics || metrics.onlineTeacherCount === 0) {
    return 'Unavailable'
  }
  return `${metrics.estimatedWaitMinutes} min`
}

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

export default function TeacherDashboardPage({ user }) {
  const [lookups, setLookups] = useState({ courses: [], locations: [] })
  const [queueTickets, setQueueTickets] = useState([])
  const [claimedTickets, setClaimedTickets] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [activeRoom, setActiveRoom] = useState(null)
  const [activationForm, setActivationForm] = useState({ buildingId: '', roomId: '' })
  const [message, setMessage] = useState('')
  const [resolutionDrafts, setResolutionDrafts] = useState({})
  const [isActivating, setIsActivating] = useState(false)

  const availableBuildings = useMemo(function() {
    return buildUniqueBuildings(lookups.locations)
  }, [lookups.locations])

  const availableRooms = useMemo(function() {
    return buildUniqueRooms(lookups.locations, activationForm.buildingId)
  }, [lookups.locations, activationForm.buildingId])

  const activeClaimedTickets = useMemo(function() {
    return claimedTickets.filter(function(ticket) {
      return ticket.status === 'ASSIGNED'
    })
  }, [claimedTickets])

  async function refreshClaimedTickets() {
    const mineData = await getMyTickets()
    setClaimedTickets(mineData)
  }

  async function refreshRoomQueue(room) {
    if (!room || !room.roomId) {
      setQueueTickets([])
      setMetrics(null)
      await refreshClaimedTickets()
      return
    }

    const [queueData, mineData, metricData] = await Promise.all([
      getQueueTickets({ buildingId: room.buildingId, roomId: room.roomId }),
      getMyTickets(),
      getQueueMetrics({ buildingId: room.buildingId, roomId: room.roomId })
    ])

    setQueueTickets(queueData)
    setClaimedTickets(mineData)
    setMetrics(metricData)
  }

  useEffect(function() {
    async function loadDashboard() {
      const [lookupData, currentActiveRoom] = await Promise.all([
        getTicketLookups(),
        getTeacherActiveRoom()
      ])

      setLookups(lookupData)
      setActiveRoom(currentActiveRoom)

      if (currentActiveRoom) {
        setActivationForm({
          buildingId: String(currentActiveRoom.buildingId),
          roomId: String(currentActiveRoom.roomId)
        })
        await refreshRoomQueue(currentActiveRoom)
      } else {
        const initialBuildings = buildUniqueBuildings(lookupData.locations)
        const buildingId = initialBuildings[0] ? String(initialBuildings[0].id) : ''
        const initialRooms = buildUniqueRooms(lookupData.locations, buildingId)
        setActivationForm({
          buildingId,
          roomId: initialRooms[0] ? String(initialRooms[0].id) : ''
        })
        await refreshClaimedTickets()
      }
    }

    loadDashboard().catch(function(error) {
      setMessage(error.message || 'Failed to load teacher dashboard.')
    })
  }, [])

  useEffect(function() {
    const exists = availableBuildings.some(function(building) {
      return String(building.id) === String(activationForm.buildingId)
    })

    if (!exists) {
      setActivationForm(function(previous) {
        return {
          ...previous,
          buildingId: availableBuildings[0] ? String(availableBuildings[0].id) : ''
        }
      })
    }
  }, [availableBuildings, activationForm.buildingId])

  useEffect(function() {
    const exists = availableRooms.some(function(room) {
      return String(room.id) === String(activationForm.roomId)
    })

    if (!exists) {
      setActivationForm(function(previous) {
        return {
          ...previous,
          roomId: availableRooms[0] ? String(availableRooms[0].id) : ''
        }
      })
    }
  }, [availableRooms, activationForm.roomId])

  useEffect(function() {
    if (!activeRoom || !activeRoom.roomId) {
      return
    }

    const intervalId = window.setInterval(function() {
      heartbeatTeacherActiveRoom().then(function(room) {
        setActiveRoom(room)
      }).catch(function(error) {
        if (error.status === 404) {
          setActiveRoom(null)
          setQueueTickets([])
          setMetrics(null)
          setMessage('Your active room session expired. Choose a room again to go back online.')
          refreshClaimedTickets().catch(function() {})
          return
        }
        setMessage(error.message || 'Unable to keep your room session active.')
      })
    }, 30000)

    return function() {
      window.clearInterval(intervalId)
    }
  }, [activeRoom?.buildingId, activeRoom?.roomId])

  useEffect(function() {
    const teacherStream = new EventSource('/events/teachers')
    let queueStream = null

    function handleRefresh() {
      refreshRoomQueue(activeRoom).catch(function() {})
    }

    teacherStream.addEventListener('teacherNotification', function(event) {
      const payload = JSON.parse(event.data)
      if (payload.type === 'TEACHER_PRESENCE_UPDATED') {
        handleRefresh()
        return
      }
      setMessage(payload.message || 'Queue updated.')
      handleRefresh()
    })

    if (activeRoom && activeRoom.roomId) {
      queueStream = new EventSource(`/events/queue?buildingId=${activeRoom.buildingId}&roomId=${activeRoom.roomId}`)
      queueStream.addEventListener('queueUpdated', handleRefresh)
      queueStream.addEventListener('queueSnapshot', handleRefresh)
      queueStream.addEventListener('queueMetrics', handleRefresh)
    }

    return function() {
      teacherStream.close()
      if (queueStream) {
        queueStream.close()
      }
    }
  }, [activeRoom?.buildingId, activeRoom?.roomId])

  async function handleActivateRoom(event) {
    event.preventDefault()
    setIsActivating(true)
    setMessage('')
    try {
      const room = await setTeacherActiveRoom({
        buildingId: Number(activationForm.buildingId),
        roomId: Number(activationForm.roomId)
      })
      setActiveRoom(room)
      await refreshRoomQueue(room)
      setMessage(`You are now active in ${room.displayLabel}.`)
    } catch (error) {
      setMessage(error.message || 'Unable to activate room.')
    } finally {
      setIsActivating(false)
    }
  }

  async function handleClearActiveRoom() {
    try {
      await clearTeacherActiveRoom()
      setActiveRoom(null)
      setQueueTickets([])
      setMetrics(null)
      await refreshClaimedTickets()
      setMessage('You are no longer active in any room.')
    } catch (error) {
      setMessage(error.message || 'Unable to clear active room.')
    }
  }

  async function handleAccept(ticketId) {
    try {
      await acceptTicket(ticketId)
      setMessage('Ticket accepted successfully.')
      await refreshRoomQueue(activeRoom)
    } catch (error) {
      setMessage(error.message || 'Unable to accept ticket.')
    }
  }

  async function handleComplete(ticketId) {
    try {
      await completeTicket(ticketId, {
        resolutionNotes: resolutionDrafts[ticketId] || ''
      })
      setMessage('Ticket marked as complete.')
      await refreshRoomQueue(activeRoom)
    } catch (error) {
      setMessage(error.message || 'Unable to complete ticket.')
    }
  }

  return (
    <div className="dashboard-screen app-dashboard-shell">
      <AppHeader
        title={`Welcome ${user.name}`}
        subtitle=""
      />

      <div className="teacher-layout-grid">
        <section className="dashboard-card">
          <div className="card-heading-row">
            <div>
              <span className="card-eyebrow">Room Activation</span>
              <h2>Go online for a room</h2>
            </div>
          </div>

          <form className="ticket-form" onSubmit={handleActivateRoom}>
            <label className="field-block">
              <span>Building</span>
              <select
                value={activationForm.buildingId}
                onChange={function(event) {
                  setActivationForm({
                    buildingId: event.target.value,
                    roomId: ''
                  })
                }}
                required
              >
                {availableBuildings.map(function(building) {
                  return <option key={building.id} value={building.id}>{building.name}</option>
                })}
              </select>
            </label>

            <label className="field-block">
              <span>Room</span>
              <select
                value={activationForm.roomId}
                onChange={function(event) {
                  setActivationForm({
                    ...activationForm,
                    roomId: event.target.value
                  })
                }}
                required
              >
                {availableRooms.map(function(room) {
                  return <option key={room.id} value={room.id}>{room.name}</option>
                })}
              </select>
            </label>

            <div className="teacher-ticket-actions">
              <button className="help-button" type="submit" disabled={isActivating || !activationForm.buildingId || !activationForm.roomId}>
                {isActivating ? 'Saving...' : activeRoom ? 'Switch active room' : 'Go online'}
              </button>
              {activeRoom ? (
                <button className="secondary-action-button" type="button" onClick={handleClearActiveRoom}>
                  Go offline
                </button>
              ) : null}
            </div>
          </form>

          <div className="queue-list top-gap-small">
            <article className="queue-ticket-card">
              <div className="queue-ticket-topline">
                <strong>Current status</strong>
              </div>
              <div className="queue-ticket-meta queue-ticket-meta-stacked">
                <span><strong>Online room:</strong> {activeRoom?.displayLabel || 'Not active yet'}</span>
                <span><strong>Activated at:</strong> {formatDateTime(activeRoom?.activatedAt)}</span>
                <span><strong>Last heartbeat:</strong> {formatDateTime(activeRoom?.lastSeenAt)}</span>
              </div>
            </article>
          </div>
        </section>

        <section className="dashboard-card">
          <div className="card-heading-row queue-heading-row">
            <div>
              <span className="card-eyebrow">Queue</span>
              <h2>{activeRoom ? `Open tickets for ${activeRoom.displayLabel}` : 'Open tickets'}</h2>
            </div>
            <div className="queue-metrics-bar compact-metrics-bar">
              <div className="metric-pill metric-pill-compact">
                <span className="metric-label">Tutors online</span>
                <strong>{metrics?.onlineTeacherCount ?? '—'}</strong>
              </div>
              <div className="metric-pill metric-pill-compact">
                <span className="metric-label">Students waiting</span>
                <strong>{metrics?.queueCount ?? 0}</strong>
              </div>
              <div className="metric-pill metric-pill-compact">
                <span className="metric-label">Estimated wait</span>
                <strong>{waitLabel(metrics)}</strong>
              </div>
            </div>
          </div>

          <div className="queue-list">
            {!activeRoom ? <div className="queue-empty-state">Choose a building and room, then go online to view and accept tickets for that room.</div> : null}
            {activeRoom && queueTickets.length === 0 ? <div className="queue-empty-state">No students are waiting in this room right now.</div> : null}
            {activeRoom && queueTickets.map(function(ticket) {
              return (
                <article className="queue-ticket-card" key={ticket.id}>
                  <div className="queue-ticket-topline">
                    <strong>{ticket.studentName}</strong>
                    <span className={`ticket-status status-${String(ticket.status).toLowerCase()}`}>{ticket.status.replace('_', ' ')}</span>
                  </div>
                  <div className="queue-ticket-meta queue-ticket-meta-stacked">
                    <span><strong>Subject:</strong> {ticket.courseLabel}</span>
                    <span><strong>Location:</strong> {ticket.locationLabel}</span>
                    <span><strong>Topic:</strong> {ticket.issueType.replace('_', ' ')}</span>
                    <span><strong>Signed in:</strong> {formatDateTime(ticket.createdAt)}</span>
                  </div>
                  <div className="ticket-note-block">
                    <span className="ticket-note-label">Note</span>
                    <p className="ticket-note">{ticket.notes || 'No extra note provided.'}</p>
                  </div>
                  <div className="teacher-ticket-actions">
                    <button className="secondary-action-button" type="button" onClick={function() { handleAccept(ticket.id) }}>
                      Accept ticket
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="dashboard-card">
          <div className="card-heading-row">
            <div>
              <span className="card-eyebrow">Your Workbench</span>
              <h2>Claimed tickets</h2>
            </div>
          </div>

          <div className="queue-list">
            {activeClaimedTickets.length === 0 ? <div className="queue-empty-state">You have no active claimed tickets.</div> : null}
            {activeClaimedTickets.map(function(ticket) {
              return (
                <article className="queue-ticket-card" key={ticket.id}>
                  <div className="queue-ticket-topline">
                    <strong>{ticket.studentName}</strong>
                    <span className="ticket-status status-assigned">ASSIGNED</span>
                  </div>
                  <div className="queue-ticket-meta queue-ticket-meta-stacked">
                    <span><strong>Subject:</strong> {ticket.courseLabel}</span>
                    <span><strong>Location:</strong> {ticket.locationLabel}</span>
                    <span><strong>Accepted at:</strong> {formatDateTime(ticket.acceptedAt)}</span>
                  </div>
                  <label className="field-block field-block-wide top-gap-small">
                    <span>Resolution notes</span>
                    <textarea
                      value={resolutionDrafts[ticket.id] || ''}
                      onChange={function(event) {
                        setResolutionDrafts(function(previous) {
                          return { ...previous, [ticket.id]: event.target.value }
                        })
                      }}
                      placeholder="Add a short summary before marking the ticket complete."
                    />
                  </label>
                  <div className="teacher-ticket-actions">
                    <button className="help-button complete-button" type="button" onClick={function() { handleComplete(ticket.id) }}>
                      Mark complete
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {message ? <div className="inline-status-message top-gap-small">{message}</div> : null}
        </section>
      </div>

    </div>
  )
}
