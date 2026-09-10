/**
 * public/app.js
 * Lógica del frontend compartida entre index.html (login/registro) y dashboard.html.
 * El bloque que se ejecuta depende de los elementos presentes en el DOM.
 */

(function () {
  'use strict';

  const TOKEN_KEY = 'auth_token';
  const USER_KEY = 'auth_user';

  // -------------------------------------------------------------------------
  // Utilidades compartidas
  // -------------------------------------------------------------------------

  const storage = {
    getToken: () => localStorage.getItem(TOKEN_KEY),
    setToken: (t) => localStorage.setItem(TOKEN_KEY, t),
    getUser: () => {
      try {
        return JSON.parse(localStorage.getItem(USER_KEY)) || null;
      } catch (e) {
        return null;
      }
    },
    setUser: (u) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
    clear: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  };

  /** Muestra un mensaje de éxito/error en el contenedor #alert. */
  function showAlert(type, message) {
    const box = document.getElementById('alert');
    if (!box) return;

    const styles = {
      error: 'bg-red-500/10 border-red-500/40 text-red-300',
      success: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300',
      info: 'bg-sky-500/10 border-sky-500/40 text-sky-300',
    };

    box.className = `mb-5 px-4 py-3 rounded-lg text-sm border ${styles[type] || styles.info}`;
    box.textContent = message;
    box.classList.remove('hidden');
  }

  function hideAlert() {
    const box = document.getElementById('alert');
    if (box) box.classList.add('hidden');
  }

  /** Formatea 'YYYY-MM-DD HH:MM:SS' a algo legible en español. */
  function formatDate(raw) {
    if (!raw) return '—';
    const fecha = new Date(raw.replace(' ', 'T'));
    if (isNaN(fecha.getTime())) return raw;
    return fecha.toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // -------------------------------------------------------------------------
  // Página: index.html (Login / Registro)
  // -------------------------------------------------------------------------

  function initAuthPage() {
    const form = document.getElementById('auth-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const spinner = document.getElementById('submit-spinner');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const passwordHint = document.getElementById('password-hint');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    const switchHint = document.getElementById('switch-hint');
    const switchLink = document.getElementById('switch-link');

    // Si ya hay una sesión activa, ir directo al dashboard.
    if (storage.getToken()) {
      window.location.replace('dashboard.html');
      return;
    }

    let modo = 'login'; // 'login' | 'register'

    const ACTIVO = ['bg-brand-600', 'text-white'];
    const INACTIVO = ['text-slate-400', 'hover:text-slate-200'];

    function setModo(nuevo) {
      modo = nuevo;
      hideAlert();
      form.reset();

      const esLogin = modo === 'login';

      tabLogin.classList.remove(...ACTIVO, ...INACTIVO);
      tabRegister.classList.remove(...ACTIVO, ...INACTIVO);
      tabLogin.classList.add(...(esLogin ? ACTIVO : INACTIVO));
      tabRegister.classList.add(...(esLogin ? INACTIVO : ACTIVO));

      pageTitle.textContent = esLogin ? 'Iniciar Sesión' : 'Crear Cuenta';
      pageSubtitle.textContent = esLogin
        ? 'Accede con tu cuenta para ver el panel'
        : 'Regístrate para acceder al panel de usuarios';
      submitText.textContent = esLogin ? 'Entrar' : 'Registrarme';
      passwordInput.autocomplete = esLogin ? 'current-password' : 'new-password';
      passwordHint.classList.toggle('hidden', esLogin);

      switchHint.firstChild.textContent = esLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? ';
      switchLink.textContent = esLogin ? 'Crea una aquí' : 'Inicia sesión';

      usernameInput.focus();
    }

    function setCargando(cargando) {
      submitBtn.disabled = cargando;
      spinner.classList.toggle('hidden', !cargando);
    }

    tabLogin.addEventListener('click', () => setModo('login'));
    tabRegister.addEventListener('click', () => setModo('register'));
    switchLink.addEventListener('click', () => setModo(modo === 'login' ? 'register' : 'login'));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      hideAlert();

      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (!username || !password) {
        showAlert('error', 'Completa el usuario y la contraseña.');
        return;
      }
      if (modo === 'register' && password.length < 6) {
        showAlert('error', 'La contraseña debe tener al menos 6 caracteres.');
        return;
      }

      const endpoint = modo === 'login' ? '/api/login' : '/api/register';
      setCargando(true);

      try {
        const respuesta = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
          showAlert('error', datos.error || 'Ocurrió un error inesperado.');
          return;
        }

        if (modo === 'register') {
          showAlert('success', `Cuenta creada para "${username}". Ya puedes iniciar sesión.`);
          setTimeout(() => {
            setModo('login');
            usernameInput.value = username;
            passwordInput.focus();
            showAlert('success', 'Registro completado. Introduce tu contraseña para entrar.');
          }, 1200);
          return;
        }

        storage.setToken(datos.token);
        storage.setUser(datos.user);
        showAlert('success', `¡Bienvenido, ${datos.user.username}! Redirigiendo al dashboard...`);
        setTimeout(() => window.location.replace('dashboard.html'), 800);
      } catch (err) {
        showAlert('error', 'No se pudo conectar con el servidor. Verifica que esté en ejecución.');
      } finally {
        setCargando(false);
      }
    });

    setModo('login');
  }

  // -------------------------------------------------------------------------
  // Página: dashboard.html (vista protegida)
  // -------------------------------------------------------------------------

  function initDashboardPage() {
    const token = storage.getToken();

    // Guardia de ruta: sin token no se puede ver el dashboard.
    if (!token) {
      window.location.replace('index.html');
      return;
    }

    const tbody = document.getElementById('users-tbody');
    const logoutBtn = document.getElementById('logout-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const currentUser = document.getElementById('current-user');
    const statTotal = document.getElementById('stat-total');
    const statUser = document.getElementById('stat-user');
    const statLast = document.getElementById('stat-last');

    const usuario = storage.getUser();
    if (usuario) {
      currentUser.textContent = usuario.username;
      statUser.textContent = usuario.username;
    }

    function cerrarSesion(mensaje) {
      storage.clear();
      const destino = mensaje
        ? `index.html?motivo=${encodeURIComponent(mensaje)}`
        : 'index.html';
      window.location.replace(destino);
    }

    function renderFilas(users) {
      if (!users.length) {
        tbody.innerHTML =
          '<tr><td colspan="3" class="px-5 py-10 text-center text-slate-500">Aún no hay usuarios registrados.</td></tr>';
        return;
      }

      tbody.innerHTML = users
        .map((u) => {
          const esActual = usuario && u.username === usuario.username;
          const badge = esActual
            ? '<span class="ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-brand-600/20 text-brand-500 border border-brand-600/40">tú</span>'
            : '';
          const inicial = u.username.charAt(0).toUpperCase();

          return `
            <tr class="hover:bg-slate-800/40 transition-colors">
              <td class="px-5 py-3 text-slate-500 font-mono">#${u.id}</td>
              <td class="px-5 py-3">
                <div class="flex items-center">
                  <span class="w-7 h-7 mr-3 rounded-full bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center shrink-0">${inicial}</span>
                  <span class="font-medium">${escapeHtml(u.username)}</span>${badge}
                </div>
              </td>
              <td class="px-5 py-3 text-slate-400">${formatDate(u.createdAt)}</td>
            </tr>`;
        })
        .join('');
    }

    async function cargarUsuarios() {
      hideAlert();
      refreshBtn.disabled = true;
      tbody.innerHTML =
        '<tr><td colspan="3" class="px-5 py-10 text-center text-slate-500">Cargando usuarios...</td></tr>';

      try {
        const respuesta = await fetch('/api/users', {
          headers: { Authorization: `Bearer ${storage.getToken()}` },
        });

        if (respuesta.status === 401) {
          cerrarSesion('Tu sesión expiró. Inicia sesión de nuevo.');
          return;
        }

        const datos = await respuesta.json();

        if (!respuesta.ok) {
          showAlert('error', datos.error || 'No se pudieron cargar los usuarios.');
          tbody.innerHTML =
            '<tr><td colspan="3" class="px-5 py-10 text-center text-red-400">Error al cargar los datos.</td></tr>';
          return;
        }

        renderFilas(datos.users);
        statTotal.textContent = datos.total;
        const ultimo = datos.users[datos.users.length - 1];
        statLast.textContent = ultimo ? ultimo.username : '—';
      } catch (err) {
        showAlert('error', 'No se pudo conectar con el servidor.');
        tbody.innerHTML =
          '<tr><td colspan="3" class="px-5 py-10 text-center text-red-400">Sin conexión con el servidor.</td></tr>';
      } finally {
        refreshBtn.disabled = false;
      }
    }

    logoutBtn.addEventListener('click', () => cerrarSesion());
    refreshBtn.addEventListener('click', cargarUsuarios);

    cargarUsuarios();
  }

  /** Evita inyección de HTML al pintar datos provenientes del servidor. */
  function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }

  /** Muestra el motivo de cierre de sesión enviado desde el dashboard. */
  function mostrarMotivoEnLogin() {
    const motivo = new URLSearchParams(window.location.search).get('motivo');
    if (motivo) {
      showAlert('info', motivo);
      history.replaceState(null, '', window.location.pathname);
    }
  }

  // -------------------------------------------------------------------------
  // Enrutado por página
  // -------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('auth-form')) {
      initAuthPage();
      mostrarMotivoEnLogin(); // después de initAuthPage: setModo() limpia los avisos
    } else if (document.getElementById('users-tbody')) {
      initDashboardPage();
    }
  });
})();
