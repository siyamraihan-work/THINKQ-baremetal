import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import {
  createBuilding,
  createCourse,
  createLocation,
  createRoom,
  downloadBlob,
  exportTicketsZip,
  getAdminLookups,
  getAdminUsers,
  getTicketAnalyticsDashboard,
  updateCourseStatus,
  updateLocationStatus,
  updateUserRole
} from '../lib/api'

const MENU_ITEMS = [
  { key: 'users', label: 'User Management' },
  { key: 'subjects', label: 'Subjects' },
  { key: 'locations', label: 'Locations' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'export', label: 'Download and Drop Tickets' }
]

function compareAlpha(left, right) {
  return left.localeCompare(right, undefined, { sensitivity: 'base' })
}

function formatMetric(value, suffix) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  return suffix ? `${value}${suffix}` : String(value)
}

function statusLabel(status) {
  return String(status || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map(function(part) {
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

function MiniBarChart({ title, items, valueKey, labelKey, emptyLabel }) {
  const maxValue = items.reduce(function(maximum, item) {
    return Math.max(maximum, Number(item[valueKey] || 0))
  }, 0)

  return (
    <article className="analytics-panel-card">
      <div className="analytics-panel-header">
        <div>
          <span className="card-eyebrow">Chart</span>
          <h3>{title}</h3>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="analytics-empty-state">{emptyLabel}</div>
      ) : (
        <div className="mini-bar-chart">
          {items.map(function(item, index) {
            const value = Number(item[valueKey] || 0)
            const width = maxValue > 0 ? Math.max((value / maxValue) * 100, value > 0 ? 8 : 0) : 0
            return (
              <div className="mini-bar-row" key={`${item[labelKey]}-${index}`}>
                <div className="mini-bar-label">{item[labelKey]}</div>
                <div className="mini-bar-track">
                  <div className="mini-bar-fill" style={{ width: `${width}%` }} />
                </div>
                <div className="mini-bar-value">{value}</div>
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}

function LineChartCard({ title, points }) {
  const width = 760
  const height = 240
  const padding = 28
  const maxValue = points.reduce(function(maximum, point) {
    return Math.max(maximum, point.created || 0, point.completed || 0)
  }, 0)

  const safeMaxValue = maxValue > 0 ? maxValue : 1
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0

  function buildPath(field) {
    return points.map(function(point, index) {
      const x = padding + index * xStep
      const y = height - padding - ((Number(point[field] || 0) / safeMaxValue) * (height - padding * 2))
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
  }

  return (
    <article className="analytics-panel-card analytics-wide-card">
      <div className="analytics-panel-header">
        <div>
          <span className="card-eyebrow">Trend</span>
          <h3>{title}</h3>
        </div>
        <div className="analytics-legend-row">
          <span className="analytics-legend-item"><span className="legend-dot legend-dot-created" />Created</span>
          <span className="analytics-legend-item"><span className="legend-dot legend-dot-completed" />Completed</span>
        </div>
      </div>
      {points.length === 0 ? (
        <div className="analytics-empty-state">No ticket history available yet.</div>
      ) : (
        <div className="line-chart-shell">
          <svg viewBox={`0 0 ${width} ${height}`} className="line-chart-svg" role="img" aria-label={title}>
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-axis" />
            <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="chart-axis" />
            <path d={buildPath('created')} className="chart-line chart-line-created" />
            <path d={buildPath('completed')} className="chart-line chart-line-completed" />
            {points.map(function(point, index) {
              const x = padding + index * xStep
              const yCreated = height - padding - ((Number(point.created || 0) / safeMaxValue) * (height - padding * 2))
              const yCompleted = height - padding - ((Number(point.completed || 0) / safeMaxValue) * (height - padding * 2))
              return (
                <g key={point.date || index}>
                  <circle cx={x} cy={yCreated} r="4" className="chart-point chart-point-created" />
                  <circle cx={x} cy={yCompleted} r="4" className="chart-point chart-point-completed" />
                </g>
              )
            })}
          </svg>
          <div className="line-chart-label-row">
            {points.map(function(point) {
              return <span key={point.date}>{String(point.date || '').slice(5)}</span>
            })}
          </div>
        </div>
      )}
    </article>
  )
}

export default function AdminDashboardPage({ user }) {
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [courses, setCourses] = useState([])
  const [buildings, setBuildings] = useState([])
  const [rooms, setRooms] = useState([])
  const [locations, setLocations] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [message, setMessage] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [courseForm, setCourseForm] = useState({ subject: '', code: '', title: '' })
  const [buildingForm, setBuildingForm] = useState({ name: '' })
  const [roomForm, setRoomForm] = useState({ buildingId: '', name: '' })
  const [tableForm, setTableForm] = useState({ buildingId: '', roomId: '', tableNumber: '' })
  const [exporting, setExporting] = useState(false)

  async function refreshAdminData() {
    const [userData, lookupData] = await Promise.all([
      getAdminUsers(),
      getAdminLookups()
    ])
    setUsers(userData)
    setCourses(lookupData.courses || [])
    setBuildings(lookupData.buildings || [])
    setRooms(lookupData.rooms || [])
    setLocations(lookupData.locations || [])
  }

  async function refreshAnalytics() {
    setLoadingAnalytics(true)
    try {
      const dashboard = await getTicketAnalyticsDashboard()
      setAnalytics(dashboard)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  async function refreshAll() {
    await refreshAdminData()
    await refreshAnalytics()
  }

  useEffect(function() {
    refreshAll().catch(function(error) {
      setMessage(error.message || 'Failed to load admin workspace.')
    })
  }, [])

  useEffect(function() {
    if (activeTab !== 'analytics' || analytics || loadingAnalytics) {
      return
    }
    refreshAnalytics().catch(function(error) {
      setMessage(error.message || 'Unable to load analytics.')
    })
  }, [activeTab, analytics, loadingAnalytics])

  const filteredUsers = useMemo(function() {
    const term = userSearch.trim().toLowerCase()
    return users
      .filter(function(item) {
        if (!term) {
          return true
        }
        return item.name.toLowerCase().includes(term) || item.email.toLowerCase().includes(term)
      })
      .slice()
      .sort(function(a, b) {
        return compareAlpha(a.name, b.name)
      })
  }, [users, userSearch])

  const sortedCourses = useMemo(function() {
    return courses.slice().sort(function(a, b) {
      return compareAlpha(a.label, b.label)
    })
  }, [courses])

  const sortedBuildings = useMemo(function() {
    return buildings.slice().sort(function(a, b) {
      return compareAlpha(a.name, b.name)
    })
  }, [buildings])

  const sortedRooms = useMemo(function() {
    return rooms.slice().sort(function(a, b) {
      return compareAlpha(a.displayLabel, b.displayLabel)
    })
  }, [rooms])

  const sortedLocations = useMemo(function() {
    return locations.slice().sort(function(a, b) {
      return compareAlpha(a.displayLabel, b.displayLabel)
    })
  }, [locations])

  const roomsForSelectedBuilding = useMemo(function() {
    return sortedRooms.filter(function(room) {
      return String(room.buildingId) === String(tableForm.buildingId)
    })
  }, [sortedRooms, tableForm.buildingId])

  useEffect(function() {
    const exists = sortedBuildings.some(function(building) {
      return String(building.id) === String(roomForm.buildingId)
    })
    if (!exists) {
      setRoomForm(function(previous) {
        return {
          ...previous,
          buildingId: sortedBuildings[0] ? String(sortedBuildings[0].id) : ''
        }
      })
    }
  }, [sortedBuildings, roomForm.buildingId])

  useEffect(function() {
    const buildingExists = sortedBuildings.some(function(building) {
      return String(building.id) === String(tableForm.buildingId)
    })
    if (!buildingExists) {
      setTableForm(function(previous) {
        return {
          ...previous,
          buildingId: sortedBuildings[0] ? String(sortedBuildings[0].id) : ''
        }
      })
    }
  }, [sortedBuildings, tableForm.buildingId])

  useEffect(function() {
    const roomExists = roomsForSelectedBuilding.some(function(room) {
      return String(room.id) === String(tableForm.roomId)
    })
    if (!roomExists) {
      setTableForm(function(previous) {
        return {
          ...previous,
          roomId: roomsForSelectedBuilding[0] ? String(roomsForSelectedBuilding[0].id) : ''
        }
      })
    }
  }, [roomsForSelectedBuilding, tableForm.roomId])

  async function handleRoleChange(userId, role) {
    try {
      await updateUserRole(userId, role)
      setMessage('User role updated.')
      await refreshAdminData()
    } catch (error) {
      setMessage(error.message || 'Unable to update user role.')
    }
  }

  async function handleCreateCourse(event) {
    event.preventDefault()
    try {
      await createCourse({
        subject: courseForm.subject,
        code: courseForm.code,
        title: courseForm.title,
        active: true
      })
      setCourseForm({ subject: '', code: '', title: '' })
      setMessage('Subject added successfully.')
      await refreshAdminData()
    } catch (error) {
      setMessage(error.message || 'Unable to add subject.')
    }
  }

  async function handleCreateBuilding(event) {
    event.preventDefault()
    try {
      await createBuilding({ name: buildingForm.name })
      setBuildingForm({ name: '' })
      setMessage('Building added successfully.')
      await refreshAdminData()
    } catch (error) {
      setMessage(error.message || 'Unable to add building.')
    }
  }

  async function handleCreateRoom(event) {
    event.preventDefault()
    try {
      await createRoom({
        buildingId: Number(roomForm.buildingId),
        name: roomForm.name
      })
      setRoomForm(function(previous) {
        return { ...previous, name: '' }
      })
      setMessage('Room added successfully.')
      await refreshAdminData()
    } catch (error) {
      setMessage(error.message || 'Unable to add room.')
    }
  }

  async function handleCreateTable(event) {
    event.preventDefault()
    try {
      await createLocation({
        roomId: Number(tableForm.roomId),
        tableNumber: tableForm.tableNumber,
        active: true
      })
      setTableForm(function(previous) {
        return { ...previous, tableNumber: '' }
      })
      setMessage('Table added successfully.')
      await refreshAdminData()
    } catch (error) {
      setMessage(error.message || 'Unable to add table.')
    }
  }

  async function handleExport() {
    const confirmed = window.confirm('This will generate the export ZIP, download it to the admin device, and permanently remove the exported tickets from the database. Continue?')
    if (!confirmed) {
      return
    }

    try {
      setExporting(true)
      const result = await exportTicketsZip()
      downloadBlob(result.blob, result.fileName)
      setMessage('Ticket export completed, downloaded, and removed from the database.')
      await refreshAnalytics()
    } catch (error) {
      setMessage(error.message || 'Unable to export tickets.')
    } finally {
      setExporting(false)
    }
  }

  const summary = analytics ? analytics.summary || {} : {}

  return (
    <div className="dashboard-screen app-dashboard-shell">
      <AppHeader
        title={`Welcome ${user.name}`}
        subtitle=""
      />

      <div className="admin-layout-grid">
        <aside className="dashboard-card admin-menu-card">
          <span className="card-eyebrow">Admin Menu</span>
          <nav className="admin-menu-list">
            {MENU_ITEMS.map(function(item) {
              return (
                <button
                  key={item.key}
                  type="button"
                  className={item.key === activeTab ? 'admin-menu-button active' : 'admin-menu-button'}
                  onClick={function() { setActiveTab(item.key) }}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>
        </aside>

        <section className="dashboard-card admin-main-card">
          {activeTab === 'users' ? (
            <div>
              <div className="card-heading-row admin-heading-row">
                <div>
                  <span className="card-eyebrow">Users</span>
                  <h2>User management</h2>
                </div>
                <div className="admin-search-box">
                  <input type="text" value={userSearch} onChange={function(event) { setUserSearch(event.target.value) }} placeholder="Search users by name or email" />
                </div>
              </div>
              <div className="admin-list-grid">
                {filteredUsers.map(function(item) {
                  return (
                    <article className="admin-record-card" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <div className="record-subtitle">{item.email}</div>
                        <div className="record-subtitle">OID: {item.oid}</div>
                      </div>
                      <div className="record-actions-row">
                        <span className={item.loggedIn ? 'presence-badge is-online' : 'presence-badge'}>{item.loggedIn ? 'Online' : 'Offline'}</span>
                        <select value={item.role} onChange={function(event) { handleRoleChange(item.id, event.target.value) }}>
                          {['STUDENT', 'TEACHER', 'ADMIN'].map(function(role) {
                            return <option key={role} value={role}>{role}</option>
                          })}
                        </select>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          ) : null}

          {activeTab === 'subjects' ? (
            <div>
              <div className="card-heading-row">
                <div>
                  <span className="card-eyebrow">Subjects</span>
                  <h2>Subject catalog</h2>
                </div>
              </div>
              <form className="inline-admin-form" onSubmit={handleCreateCourse}>
                <input type="text" value={courseForm.subject} onChange={function(event) { setCourseForm({ ...courseForm, subject: event.target.value }) }} placeholder="Subject, for example CSC" required />
                <input type="text" value={courseForm.code} onChange={function(event) { setCourseForm({ ...courseForm, code: event.target.value }) }} placeholder="Code, for example 337" required />
                <input type="text" value={courseForm.title} onChange={function(event) { setCourseForm({ ...courseForm, title: event.target.value }) }} placeholder="Title" required />
                <button className="secondary-action-button" type="submit">Add subject</button>
              </form>
              <div className="admin-list-grid top-gap-small">
                {sortedCourses.map(function(course) {
                  return (
                    <article className="admin-record-card" key={course.id}>
                      <div>
                        <strong>{course.label}</strong>
                        <div className="record-subtitle">{course.title}</div>
                      </div>
                      <button
                        className={course.active ? 'toggle-status-button active' : 'toggle-status-button inactive'}
                        type="button"
                        onClick={function() { updateCourseStatus(course.id, !course.active).then(refreshAdminData).catch(function(error) { setMessage(error.message || 'Unable to update subject status.') }) }}
                      >
                        {course.active ? 'Active' : 'Inactive'}
                      </button>
                    </article>
                  )
                })}
              </div>
            </div>
          ) : null}

          {activeTab === 'locations' ? (
            <div>
              <div className="card-heading-row">
                <div>
                  <span className="card-eyebrow">Locations</span>
                  <h2>Buildings, rooms, and support tables</h2>
                </div>
              </div>

              <div className="location-admin-layout">
                <section className="location-admin-section">
                  <h3>1. Add building</h3>
                  <form className="inline-admin-form location-form-grid" onSubmit={handleCreateBuilding}>
                    <input type="text" value={buildingForm.name} onChange={function(event) { setBuildingForm({ name: event.target.value }) }} placeholder="Building name" required />
                    <button className="secondary-action-button" type="submit">Add building</button>
                  </form>
                  <div className="admin-list-grid top-gap-small">
                    {sortedBuildings.map(function(building) {
                      return (
                        <article className="admin-record-card" key={building.id}>
                          <div>
                            <strong>{building.name}</strong>
                            <div className="record-subtitle">Building</div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>

                <section className="location-admin-section">
                  <h3>2. Add room to a building</h3>
                  <form className="inline-admin-form location-form-grid" onSubmit={handleCreateRoom}>
                    <select value={roomForm.buildingId} onChange={function(event) { setRoomForm({ ...roomForm, buildingId: event.target.value }) }} required>
                      {sortedBuildings.map(function(building) {
                        return <option key={building.id} value={building.id}>{building.name}</option>
                      })}
                    </select>
                    <input type="text" value={roomForm.name} onChange={function(event) { setRoomForm({ ...roomForm, name: event.target.value }) }} placeholder="Room name or number" required />
                    <button className="secondary-action-button" type="submit" disabled={!roomForm.buildingId}>Add room</button>
                  </form>
                  <div className="admin-list-grid top-gap-small">
                    {sortedRooms.map(function(room) {
                      return (
                        <article className="admin-record-card" key={room.id}>
                          <div>
                            <strong>Room {room.name}</strong>
                            <div className="record-subtitle">{room.buildingName}</div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>

                <section className="location-admin-section">
                  <h3>3. Add table to a room</h3>
                  <form className="inline-admin-form location-form-grid table-form-grid" onSubmit={handleCreateTable}>
                    <select value={tableForm.buildingId} onChange={function(event) { setTableForm({ ...tableForm, buildingId: event.target.value, roomId: '' }) }} required>
                      {sortedBuildings.map(function(building) {
                        return <option key={building.id} value={building.id}>{building.name}</option>
                      })}
                    </select>
                    <select value={tableForm.roomId} onChange={function(event) { setTableForm({ ...tableForm, roomId: event.target.value }) }} required>
                      {roomsForSelectedBuilding.map(function(room) {
                        return <option key={room.id} value={room.id}>{room.name}</option>
                      })}
                    </select>
                    <input type="text" value={tableForm.tableNumber} onChange={function(event) { setTableForm({ ...tableForm, tableNumber: event.target.value }) }} placeholder="Table number" required />
                    <button className="secondary-action-button" type="submit" disabled={!tableForm.roomId}>Add table</button>
                  </form>
                  <div className="admin-list-grid top-gap-small">
                    {sortedLocations.map(function(location) {
                      return (
                        <article className="admin-record-card" key={location.id}>
                          <div>
                            <strong>{location.buildingName}</strong>
                            <div className="record-subtitle">Room {location.roomName} · Table {location.tableNumber}</div>
                          </div>
                          <button
                            className={location.active ? 'toggle-status-button active' : 'toggle-status-button inactive'}
                            type="button"
                            onClick={function() { updateLocationStatus(location.id, !location.active).then(refreshAdminData).catch(function(error) { setMessage(error.message || 'Unable to update table status.') }) }}
                          >
                            {location.active ? 'Active' : 'Inactive'}
                          </button>
                        </article>
                      )
                    })}
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {activeTab === 'analytics' ? (
            <div className="analytics-dashboard-shell">
              <div className="card-heading-row analytics-heading-row">
                <div>
                  <span className="card-eyebrow">Analytics</span>
                  <h2>Operational ticket analytics</h2>
                  <p className="admin-panel-copy">Ratings, queue volume, performance by location and teacher, and recent student feedback in one admin view.</p>
                </div>
                <button className="secondary-action-button" type="button" onClick={function() { refreshAnalytics().catch(function(error) { setMessage(error.message || 'Unable to refresh analytics.') }) }}>
                  {loadingAnalytics ? 'Refreshing...' : 'Refresh analytics'}
                </button>
              </div>

              {!analytics && loadingAnalytics ? <div className="analytics-empty-state">Loading analytics workspace...</div> : null}

              {analytics ? (
                <div className="analytics-stack">
                  <section className="analytics-kpi-grid">
                    <article className="analytics-kpi-card"><span>Total tickets</span><strong>{formatMetric(summary.totalTickets)}</strong></article>
                    <article className="analytics-kpi-card"><span>Active tickets</span><strong>{formatMetric(summary.activeTickets)}</strong></article>
                    <article className="analytics-kpi-card"><span>Completion rate</span><strong>{formatMetric(summary.completionRate, '%')}</strong></article>
                    <article className="analytics-kpi-card"><span>Average rating</span><strong>{formatMetric(summary.averageRating)}</strong></article>
                    <article className="analytics-kpi-card"><span>Average wait</span><strong>{formatMetric(summary.averageWaitMinutes, ' min')}</strong></article>
                    <article className="analytics-kpi-card"><span>Median wait</span><strong>{formatMetric(summary.medianWaitMinutes, ' min')}</strong></article>
                    <article className="analytics-kpi-card"><span>Average resolution</span><strong>{formatMetric(summary.averageCompletionMinutes, ' min')}</strong></article>
                    <article className="analytics-kpi-card"><span>Median resolution</span><strong>{formatMetric(summary.medianCompletionMinutes, ' min')}</strong></article>
                    <article className="analytics-kpi-card"><span>Unclaimed tickets</span><strong>{formatMetric(summary.unclaimedTickets)}</strong></article>
                    <article className="analytics-kpi-card"><span>Long waits over 15m</span><strong>{formatMetric(summary.longWaitTickets)}</strong></article>
                    <article className="analytics-kpi-card"><span>Low ratings 1-2</span><strong>{formatMetric(summary.lowRatedTickets)}</strong></article>
                    <article className="analytics-kpi-card"><span>Comment coverage</span><strong>{formatMetric(summary.commentCoverage, '%')}</strong></article>
                    <article className="analytics-kpi-card"><span>7-day trend</span><strong>{formatMetric(summary.ticketTrendDeltaPercent, '%')}</strong></article>
                  </section>

                  <LineChartCard title="Daily created vs completed tickets" points={analytics.dailyVolume || []} />

                  <section className="analytics-grid-two">
                    <MiniBarChart title="Ticket status breakdown" items={(analytics.statusBreakdown || []).map(function(item) { return { label: statusLabel(item.status), count: item.count } })} valueKey="count" labelKey="label" emptyLabel="No status data yet." />
                    <MiniBarChart title="Rating distribution" items={(analytics.ratingDistribution || []).map(function(item) { return { label: `${item.rating} star`, count: item.count } })} valueKey="count" labelKey="label" emptyLabel="No ratings have been submitted yet." />
                    <MiniBarChart title="Top requested topics" items={analytics.topTopics || []} valueKey="count" labelKey="topic" emptyLabel="No topic data available." />
                    <MiniBarChart title="Hourly ticket demand" items={(analytics.hourlyDistribution || []).filter(function(item) { return item.count > 0 }).map(function(item) { return { hour: `${item.hour}:00`, count: item.count } })} valueKey="count" labelKey="hour" emptyLabel="No hourly trend data available." />
                    <MiniBarChart title="Wait time bands" items={analytics.waitTimeBands || []} valueKey="count" labelKey="label" emptyLabel="No wait-time data available." />
                    <MiniBarChart title="Resolution time bands" items={analytics.resolutionTimeBands || []} valueKey="count" labelKey="label" emptyLabel="No completion-time data available." />
                  </section>

                  <section className="analytics-table-grid">
                    <article className="analytics-panel-card">
                      <div className="analytics-panel-header">
                        <div>
                          <span className="card-eyebrow">Locations</span>
                          <h3>Location performance</h3>
                        </div>
                      </div>
                      <div className="analytics-table-wrap">
                        <table className="analytics-table">
                          <thead>
                            <tr>
                              <th>Location</th>
                              <th>Tickets</th>
                              <th>Completed</th>
                              <th>Avg rating</th>
                              <th>Avg wait</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(analytics.locationBreakdown || []).map(function(item) {
                              return (
                                <tr key={item.location}>
                                  <td>{item.location}</td>
                                  <td>{item.ticketCount}</td>
                                  <td>{item.completedCount}</td>
                                  <td>{formatMetric(item.averageRating)}</td>
                                  <td>{formatMetric(item.averageWaitMinutes, ' min')}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </article>

                    <article className="analytics-panel-card">
                      <div className="analytics-panel-header">
                        <div>
                          <span className="card-eyebrow">Teachers</span>
                          <h3>Teacher performance</h3>
                        </div>
                      </div>
                      <div className="analytics-table-wrap">
                        <table className="analytics-table">
                          <thead>
                            <tr>
                              <th>Teacher</th>
                              <th>Handled</th>
                              <th>Completed</th>
                              <th>Avg rating</th>
                              <th>Avg resolution</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(analytics.teacherBreakdown || []).map(function(item) {
                              return (
                                <tr key={item.teacher}>
                                  <td>{item.teacher}</td>
                                  <td>{item.handledCount}</td>
                                  <td>{item.completedCount}</td>
                                  <td>{formatMetric(item.averageRating)}</td>
                                  <td>{formatMetric(item.averageCompletionMinutes, ' min')}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  </section>

                  <article className="analytics-panel-card">
                    <div className="analytics-panel-header">
                      <div>
                        <span className="card-eyebrow">Operations</span>
                        <h3>Tickets needing attention</h3>
                      </div>
                    </div>
                    <div className="analytics-table-wrap">
                      <table className="analytics-table">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Topic</th>
                            <th>Location</th>
                            <th>Status</th>
                            <th>Owner</th>
                            <th>Wait</th>
                            <th>Flag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(analytics.attentionTickets || []).length === 0 ? (
                            <tr>
                              <td colSpan="7">No tickets are currently flagged for attention.</td>
                            </tr>
                          ) : (
                            (analytics.attentionTickets || []).map(function(item) {
                              return (
                                <tr key={item.ticketId || `${item.studentName}-${item.topic}`}>
                                  <td>{item.studentName || 'Student'}</td>
                                  <td>{item.topic || 'Unknown'}</td>
                                  <td>{item.location || 'Unknown'}</td>
                                  <td>{statusLabel(item.status)}</td>
                                  <td>{item.claimName || 'Unassigned'}</td>
                                  <td>{formatMetric(item.waitMinutes, ' min')}</td>
                                  <td>{(item.reasons || []).join(', ')}</td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="analytics-panel-card">
                    <div className="analytics-panel-header">
                      <div>
                        <span className="card-eyebrow">Feedback</span>
                        <h3>Recent student feedback</h3>
                      </div>
                    </div>
                    <div className="analytics-feedback-list">
                      {(analytics.recentFeedback || []).length === 0 ? (
                        <div className="analytics-empty-state">Recent student comments will appear here after tickets are rated.</div>
                      ) : (
                        (analytics.recentFeedback || []).map(function(item) {
                          return (
                            <article className="analytics-feedback-card" key={item.ticketId || `${item.studentName}-${item.completedAt}`}>
                              <div className="analytics-feedback-topline">
                                <strong>{item.studentName || 'Student'}</strong>
                                <span className="presence-badge">{item.rating ? `${item.rating}/5` : 'No score'}</span>
                              </div>
                              <div className="record-subtitle">{item.topic} · {item.location}</div>
                              <div className="record-subtitle">Handled by {item.claimName || 'Unassigned'}</div>
                              <p className="analytics-feedback-copy">{item.comments || 'No written comment left.'}</p>
                            </article>
                          )
                        })
                      )}
                    </div>
                  </article>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'export' ? (
            <div className="export-panel">
              <span className="card-eyebrow">Ticket Export</span>
              <h2>Download and drop tickets</h2>
              <p className="admin-panel-copy">
                This action generates one Excel file per location, packages everything into a ZIP download for the admin device, and then clears the exported tickets from the database.
              </p>
              <button className="help-button admin-export-button" type="button" onClick={handleExport} disabled={exporting}>
                {exporting ? 'Preparing export...' : 'Download and drop tickets'}
              </button>
            </div>
          ) : null}

          {message ? <div className="inline-status-message top-gap-small">{message}</div> : null}
        </section>
      </div>

    </div>
  )
}
