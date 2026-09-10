const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token) {
  window.location.href = '/login.html';
}

document.getElementById('welcome-msg').textContent = user ? `Hola, ${user.name}` : '';

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
});

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  try {
    const res = await fetch('/api/users', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login.html';
      return;
    }

    const users = await res.json();

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">No hay usuarios registrados</td></tr>';
      return;
    }

    tbody.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${u.created_at}</td>
      </tr>`
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">Error al cargar usuarios</td></tr>';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

loadUsers();
