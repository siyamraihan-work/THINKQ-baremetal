export function roleHomePath(role) {
  if (role === 'ADMIN') {
    return '/admin/dashboard'
  }
  if (role === 'TEACHER') {
    return '/tutor/dashboard'
  }
  return '/student/dashboard'
}
