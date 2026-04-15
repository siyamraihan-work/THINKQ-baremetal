async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    },
    ...options
  })

  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const body = isJson ? await response.json().catch(function() { return null }) : null

  if (!response.ok) {
    const error = new Error(body?.error || body?.detail || `Request failed with status ${response.status}`)
    error.status = response.status
    error.body = body
    throw error
  }

  return body
}

function withQuery(path, params) {
  const searchParams = new URLSearchParams()
  Object.entries(params || {}).forEach(function(entry) {
    const key = entry[0]
    const value = entry[1]
    if (value === undefined || value === null || value === '') {
      return
    }
    searchParams.set(key, String(value))
  })

  const query = searchParams.toString()
  return query ? `${path}?${query}` : path
}

export function getCurrentUser() {
  return request('/users/me', { method: 'GET' })
}

export function pingSession() {
  return request('/auth/ping', { method: 'GET' })
}

export function startLogin() {
  window.location.href = '/auth/login'
}

export async function logout() {
  await request('/auth/logout', { method: 'POST' })
}

export function getTicketLookups() {
  return request('/tickets/lookups', { method: 'GET' })
}

export function getMyTickets() {
  return request('/tickets/mine', { method: 'GET' })
}

export function getQueueTickets(params) {
  return request(withQuery('/tickets/queue', params), { method: 'GET' })
}

export function getQueueMetrics(params) {
  return request(withQuery('/tickets/wait-metrics', params), { method: 'GET' })
}

export function createTicket(payload) {
  return request('/tickets/', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getTeacherActiveRoom() {
  return request('/tickets/teacher/active-room', { method: 'GET' })
}

export function setTeacherActiveRoom(payload) {
  return request('/tickets/teacher/active-room', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function heartbeatTeacherActiveRoom() {
  return request('/tickets/teacher/active-room/heartbeat', { method: 'POST' })
}

export function clearTeacherActiveRoom() {
  return request('/tickets/teacher/active-room', { method: 'DELETE' })
}

export function acceptTicket(ticketId) {
  return request(`/tickets/${ticketId}/accept`, { method: 'POST' })
}

export function completeTicket(ticketId, payload) {
  return request(`/tickets/${ticketId}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload || {})
  })
}

export function submitTicketFeedback(ticketId, payload) {
  return request(`/tickets/${ticketId}/feedback`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getAdminUsers() {
  return request('/admin/users', { method: 'GET' })
}

export function updateUserRole(userId, role) {
  return request(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  })
}

export function getAdminLookups() {
  return request('/admin/lookups', { method: 'GET' })
}

export function getTicketAnalyticsDashboard() {
  return request('/analytics/tickets/dashboard', { method: 'GET' })
}

export function createCourse(payload) {
  return request('/admin/courses', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function updateCourseStatus(courseId, active) {
  return request(`/admin/courses/${courseId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ active })
  })
}

export function createBuilding(payload) {
  return request('/admin/buildings', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function createRoom(payload) {
  return request('/admin/rooms', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function createLocation(payload) {
  return request('/admin/locations', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function updateLocationStatus(locationId, active) {
  return request(`/admin/locations/${locationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ active })
  })
}

export async function exportTicketsZip() {
  const response = await fetch('/analytics/tickets/export', {
    method: 'POST',
    credentials: 'include'
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const body = await response.json()
      message = body?.detail || body?.error || message
    } catch (error) {}
    throw new Error(message)
  }

  const blob = await response.blob()
  const suggestedName = getFileNameFromDisposition(response.headers.get('content-disposition')) || 'ticket-export.zip'
  return { blob, fileName: suggestedName }
}

function getFileNameFromDisposition(contentDisposition) {
  if (!contentDisposition) {
    return null
  }

  const match = contentDisposition.match(/filename="?([^";]+)"?/i)
  return match ? match[1] : null
}

export function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}

export async function devLogin(payload) {
  return request('/auth/dev-login', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export { request }
