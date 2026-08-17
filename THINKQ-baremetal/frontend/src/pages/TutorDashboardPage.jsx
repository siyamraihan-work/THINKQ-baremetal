import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import {
  acceptTicket,
  clearTeacherActiveRoom,
  completeTicket,
  getMyTickets,
  getQueueTickets,
  getTeacherActiveRoom,
  getTicketLookups,
  heartbeatTeacherActiveRoom,
  requeueTicket,
  setTeacherActiveRoom
} from '../lib/api'

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

export default function TutorDashboardPage({ user }) {
  const [lookups, setLookups] = useState({ courses: [], locations: [] })
  const [queueTickets, setQueueTickets] = useState([])
  const [claimedTickets, setClaimedTickets] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [offers, setOffers] = useState([])
  const [activationForm, setActivationForm] = useState({ buildingId: '', roomId: '' })
  const [message, setMessage] = useState('')
  const [resolutionDrafts, setResolutionDrafts] = useState({})
  const [isActivating, setIsActivating] = useState(false)
  const [isRoomSheetOpen, setIsRoomSheetOpen] = useState(false)
  const [isClaimedSheetOpen, setIsClaimedSheetOpen] = useState(false)

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

  const visibleOffers = useMemo(function() {
    if (!activeRoom || !activeRoom.roomId) {
      return []
    }
    return offers.filter(function(offer) {
      return Number(offer.roomId) === Number(activeRoom.roomId)
    })
  }, [offers, activeRoom?.roomId])

  async function refreshClaimedTickets() {
    const mineData = await getMyTickets()
    setClaimedTickets(mineData)
  }

  async function refreshRoomQueue(room) {
    if (!room || !room.roomId) {
      setQueueTickets([])
      await refreshClaimedTickets()
      return
    }

    const [queueData, mineData] = await Promise.all([
      getQueueTickets({ buildingId: room.buildingId, roomId: room.roomId }),
      getMyTickets()
    ])

    setQueueTickets(queueData)
    setClaimedTickets(mineData)
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
      setMessage(error.message || 'Failed to load tutor dashboard.')
    })
  }, [])

  useEffect(function() {
    if (!isRoomSheetOpen && !isClaimedSheetOpen) {
      return
    }
    document.body.classList.add('sheet-lock')
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsRoomSheetOpen(false)
        setIsClaimedSheetOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return function() {
      document.body.classList.remove('sheet-lock')
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isRoomSheetOpen, isClaimedSheetOpen])

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
          setOffers([])
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

    teacherStream.addEventListener('ticketOffer', function(event) {
      const ticket = JSON.parse(event.data)
      setOffers(function(previous) {
        if (previous.some(function(item) { return Number(item.id) === Number(ticket.id) })) {
          return previous
        }
        return previous.concat(ticket)
      })
      handleRefresh()
    })

    teacherStream.addEventListener('ticketOfferResolved', function(event) {
      const payload = JSON.parse(event.data)
      setOffers(function(previous) {
        return previous.filter(function(item) { return Number(item.id) !== Number(payload.ticketId) })
      })
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
      setIsRoomSheetOpen(false)
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
      setIsRoomSheetOpen(false)
      setQueueTickets([])
      setOffers([])
      await refreshClaimedTickets()
      setMessage('You are no longer active in any room.')
    } catch (error) {
      setMessage(error.message || 'Unable to clear active room.')
    }
  }

  async function handleAccept(ticketId) {
    try {
      await acceptTicket(ticketId)
      handleDismissOffer(ticketId)
      setMessage('Ticket accepted successfully.')
      await refreshRoomQueue(activeRoom)
    } catch (error) {
      setMessage(error.message || 'Unable to accept ticket.')
    }
  }

  function handleDismissOffer(ticketId) {
    setOffers(function(previous) {
      return previous.filter(function(item) { return Number(item.id) !== Number(ticketId) })
    })
  }

  async function handleAcceptOffer(ticketId) {
    try {
      await acceptTicket(ticketId)
      handleDismissOffer(ticketId)
      setMessage('Ticket accepted successfully.')
    } catch (error) {
      handleDismissOffer(ticketId)
      setMessage(error.message || 'Unable to accept ticket.')
    }

    await refreshRoomQueue(activeRoom).catch(function() {})
  }

  async function handleRequeue(ticketId) {
    const confirmed = window.confirm('Return this ticket to the queue? Another tutor will be able to accept it.')
    if (!confirmed) {
      return
    }
    try {
      await requeueTicket(ticketId)
      setMessage('Ticket returned to the queue.')
      await refreshRoomQueue(activeRoom)
    } catch (error) {
      setMessage(error.message || 'Unable to return the ticket to the queue.')
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
        queueCount={activeRoom ? queueTickets.length : null}
      />

      {message ? <div className="inline-status-message page-status-message">{message}</div> : null}

      <div className="teacher-layout-grid">
        <section className={isRoomSheetOpen ? 'dashboard-card activation-card mobile-sheet sheet-open' : 'dashboard-card activation-card mobile-sheet'}>
          <div className="sheet-head">
            <span className="sheet-grabber" aria-hidden="true" />
            <button className="sheet-close" type="button" aria-label="Close room panel" onClick={function() { setIsRoomSheetOpen(false) }}>×</button>
          </div>

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

        <section className={isClaimedSheetOpen ? 'dashboard-card claimed-card mobile-sheet sheet-open' : 'dashboard-card claimed-card mobile-sheet'}>
          <div className="sheet-head">
            <span className="sheet-grabber" aria-hidden="true" />
            <button className="sheet-close" type="button" aria-label="Close claimed tickets" onClick={function() { setIsClaimedSheetOpen(false) }}>×</button>
          </div>

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
                        const nextValue = event.target.value
                        setResolutionDrafts(function(previous) {
                          return { ...previous, [ticket.id]: nextValue }
                        })
                      }}
                      placeholder="Add a short summary before marking the ticket complete."
                    />
                  </label>
                  <div className="teacher-ticket-actions">
                    <button className="help-button complete-button" type="button" onClick={function() { handleComplete(ticket.id) }}>
                      Mark complete
                    </button>
                    <button className="requeue-button" type="button" onClick={function() { handleRequeue(ticket.id) }}>
                      Return to queue
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>

      {isRoomSheetOpen || isClaimedSheetOpen ? (
        <div
          className="mobile-sheet-backdrop"
          role="presentation"
          onClick={function() {
            setIsRoomSheetOpen(false)
            setIsClaimedSheetOpen(false)
          }}
        />
      ) : null}

      <div className="mobile-fab-row fab-row-split">
        <button
          className={activeRoom ? 'mobile-fab fab-online is-online' : 'mobile-fab fab-online'}
          type="button"
          onClick={function() {
            setIsClaimedSheetOpen(false)
            setIsRoomSheetOpen(true)
          }}
        >
          <span className="fab-dot" aria-hidden="true" />
          <span className="fab-label">{activeRoom ? `Online · ${activeRoom.displayLabel}` : 'Go Online'}</span>
        </button>
        <button
          className="mobile-fab fab-claimed"
          type="button"
          onClick={function() {
            setIsRoomSheetOpen(false)
            setIsClaimedSheetOpen(true)
          }}
        >
          <span className="fab-emoji" aria-hidden="true">🎟️</span>
          <span className="fab-label">Claimed tickets</span>
          {activeClaimedTickets.length > 0 ? <span className="fab-count">{activeClaimedTickets.length}</span> : null}
        </button>
      </div>

      {visibleOffers.length > 0 ? (
        <div className="offer-stack">
          {visibleOffers.map(function(offer) {
            return (
              <article className="offer-card" key={offer.id}>
                <div className="offer-head">
                  <span className="offer-eyebrow">New help request</span>
                  <button className="offer-dismiss-button" type="button" aria-label="Dismiss notification" onClick={function() { handleDismissOffer(offer.id) }}>×</button>
                </div>
                <div className="offer-student">{offer.studentName}</div>
                <div className="offer-meta">
                  <span className="offer-meta-row"><strong>Subject:</strong> {offer.courseLabel}</span>
                  <span className="offer-meta-row"><strong>Location:</strong> {offer.locationLabel}</span>
                  <span className="offer-meta-row"><strong>Topic:</strong> {String(offer.issueType || '').replace('_', ' ')}</span>
                </div>
                {offer.notes ? <p className="offer-note">{offer.notes}</p> : null}
                <div className="offer-actions">
                  <button className="offer-accept-button" type="button" onClick={function() { handleAcceptOffer(offer.id) }}>Accept ticket</button>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}

    </div>
  )
}
