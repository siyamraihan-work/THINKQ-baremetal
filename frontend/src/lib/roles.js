export function roleHomePath(role) {
  if (role === 'ADMIN') {
    return '/admin/dashboard'
  }
  if (role === 'TEACHER') {
    return '/teacher/dashboard'
  }
  return '/student/dashboard'
}
