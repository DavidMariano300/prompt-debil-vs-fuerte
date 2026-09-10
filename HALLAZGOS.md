# Hallazgos técnicos

Análisis comparativo línea a línea entre `./Debil` y `./Fuerte`. Cada afirmación apunta al
archivo y la línea donde puede verificarse.

---

## 1. Seguridad y autenticación

### 1.1 Hashing de contraseñas

Ambos usan `bcryptjs` con salt de 10 rondas. La diferencia es el modo:

| | Archivo | Código |
|---|---|---|
| `Debil` | `src/routes/auth.js:23,39` | `bcrypt.hashSync(...)` / `bcrypt.compareSync(...)` |
| `Fuerte` | `server.js:74,108` | `await bcrypt.hash(...)` / `await bcrypt.compare(...)` |

bcrypt con 10 rondas tarda ~100 ms a propósito. En su versión síncrona **bloquea el event loop
de Node durante todo ese tiempo**, así que en `./Debil` un login congela el servidor entero para
todos los usuarios simultáneos. `./Fuerte` además extrae el factor a una constante nombrada
(`SALT_ROUNDS`, `server.js:21`) en lugar de dejar un `10` mágico.

### 1.2 Validación del secreto JWT

`./Fuerte` comprueba la configuración antes de aceptar tráfico (`server.js:23-26`):

```js
if (!JWT_SECRET) {
  console.error('[CONFIG ERROR] Falta la variable JWT_SECRET en el archivo .env');
  process.exit(1);
}
```

`./Debil` no valida nada: pasa `process.env.JWT_SECRET` directamente a `jwt.sign`
(`src/routes/auth.js:45`) y a `jwt.verify` (`src/middleware/auth.js:12`). Sin `.env` el servidor
**arranca con normalidad** y el fallo aparece más tarde, como un 500 opaco en el primer login.
Es la diferencia entre un error de despliegue detectado en 1 segundo y uno detectado por un
usuario.

### 1.3 Contenido del token

| | Payload | Archivo |
|---|---|---|
| `Debil` | `{ id, name, email }` | `src/routes/auth.js:44` |
| `Fuerte` | `{ id, username }` | `server.js:117` |

Un JWT va firmado, pero **no cifrado**: su contenido es legible por cualquiera que tenga el token
(un `atob()` basta). `./Debil` mete el nombre y el correo del usuario dentro, de modo que esos
datos personales viajan y se almacenan en `localStorage` en claro. `./Fuerte` emite los claims
mínimos y consulta el resto por endpoint autenticado.

### 1.4 Manejo de errores en rutas

`./Debil` tiene **cero** bloques `try/catch` en `src/routes/auth.js` y `src/routes/users.js`. Como
son handlers síncronos, cualquier excepción de `better-sqlite3` sube al manejador por defecto de
Express, que en modo desarrollo **responde con el stack trace completo**.

`./Fuerte` envuelve cada endpoint (`server.js:67`, `98`, `140`) y añade dos redes de seguridad:

- 404 en JSON para rutas de API inexistentes (`server.js:158-160`)
- middleware de error centralizado (`server.js:162-165`) que registra el detalle en el servidor
  y devuelve un mensaje genérico al cliente

### 1.5 Expiración de sesión

`./Debil` responde siempre lo mismo (`src/middleware/auth.js:16`):

```js
return res.status(401).json({ error: 'Token inválido o expirado' });
```

`./Fuerte` distingue el caso (`middleware/auth.js:24-27`) comprobando `err.name === 'TokenExpiredError'`
y devuelve *«La sesión ha expirado. Inicia sesión de nuevo.»*, que es accionable para el usuario.

### 1.6 Consulta de credenciales

`./Debil` hace `SELECT *` al buscar al usuario (`src/routes/auth.js:38`), cargando el registro
completo. `./Fuerte` enumera columnas explícitamente (`database.js:96`) y aísla la lista pública
en una consulta que **nunca** selecciona `password` (`database.js:113-117`).

### 1.7 Empates

- Ambos usan **consultas parametrizadas** (`?`): ninguno es vulnerable a inyección SQL.
- Ambos excluyen `password` de las respuestas de la API.
- Ambos listan `.env` en su `.gitignore`.
- **Ninguno** incluye un `.env.example`.

---

## 2. Arquitectura y mantenibilidad

### 2.1 Estructura de archivos

```
Debil/  (118 líneas de backend)          Fuerte/  (379 líneas de backend)
src/                                     server.js            213
├── server.js        26                  database.js          130
├── routes/                              middleware/auth.js    36
│   ├── auth.js      52                  README.md             71
│   └── users.js     21
├── middleware/auth.js
└── db/index.js      19
```

**Aquí `./Debil` gana en un aspecto.** Su separación en carpetas por responsabilidad es más
ortodoxa que el `server.js` monolítico de `./Fuerte`, donde conviven los cuatro endpoints, los
middlewares y el arranque. A partir de ~10 endpoints, `./Fuerte` necesitaría refactorizarse.

Lo que pierde `./Debil` es la sustancia dentro de esa estructura: `src/db/index.js` se limita a
exportar la conexión cruda (19 líneas), así que **el SQL queda disperso por los archivos de rutas**.
`./Fuerte` sí tiene una capa de acceso a datos con funciones de dominio —`findUserByUsername`,
`createUser`, `listUsers` (`database.js:94-118`)— envueltas en promesas y con logging uniforme.

### 2.2 Documentación

| | `Debil` | `Fuerte` |
|---|---|---|
| README | no existe | 71 líneas |
| Comentarios | ninguno | JSDoc en cada función exportada |

El README de `./Fuerte` incluye tabla de endpoints, tabla de variables de entorno, ejemplo con
`curl`, descripción de la estructura y muestra del formato de logs.

### 2.3 Ciclo de vida del proceso

Exclusivo de `./Fuerte`:

- Banner de arranque con estado, URL, archivo de base de datos y vigencia del JWT (`server.js:176-189`)
- Mensaje accionable si el puerto está ocupado (`server.js:192-200`): `EADDRINUSE` explica qué hacer
- Cierre ordenado de la base de datos al recibir `SIGINT` (`server.js:207-213`)

`./Debil` no maneja ninguno de los tres casos.

### 2.4 Versionado de dependencias — empate

Los dos declaran rangos con `^` en `package.json` y fijan versiones exactas con
`package-lock.json` v3 (123 vs. 210 paquetes). **La reproducibilidad es equivalente.** Las
diferencias reales son de metadatos y elección de librería:

| | `Debil` | `Fuerte` |
|---|---|---|
| Driver SQLite | `better-sqlite3` (nativo, síncrono) | `sqlite3` (asíncrono) |
| Metadatos npm | sin licencia, autor ni keywords | licencia MIT, keywords |
| Scripts | `start` + `dev` con `--watch` | solo `start` |

El script `dev` con `--watch` es un punto a favor de `./Debil`.

---

## 3. Observabilidad y logs

**`./Debil` tiene exactamente una sentencia `console` en todo el backend** (`src/server.js:25`):

```
Servidor escuchando en http://localhost:3002
```

Eso es todo. No hay registro de peticiones, ni de autenticación, ni de errores, ni de consultas.
Depurar un fallo exige añadir `console.log` a mano y reproducir el problema.

**`./Fuerte` tiene 37**, organizadas por prefijo para poder filtrarlas con `grep`:

| Prefijo | Origen | Propósito |
|---|---|---|
| `[TIMESTAMP] [MÉTODO] [RUTA] - IP` | `server.js:36-43` | Toda petición HTTP entrante |
| `[DATABASE]` | `database.js:13-15` | Cada consulta SQL ejecutada |
| `[REGISTRO]` / `[REGISTRO ERROR]` | `server.js:70,77` | Altas de usuario |
| `[AUTH]` / `[AUTH ERROR]` | `server.js:103,111,122` | Logins correctos y fallidos |
| `[SECURITY]` / `[SECURITY ALERT]` | `middleware/auth.js:13,21,31` | Auditoría de accesos protegidos |
| `[SERVER ERROR]` / `[FATAL]` | `server.js:83,129,163,202` | Fallos con contexto |
| `[CONFIG ERROR]` | `server.js:24` | Configuración inválida al arrancar |

El middleware HTTP registra timestamp ISO, método, ruta e IP, normalizando el prefijo `::ffff:`
de IPv4 mapeada (`server.js:38-40`).

---

## 4. Frontend

### 4.1 Interfaz

| | `Debil` | `Fuerte` |
|---|---|---|
| Estilos | `style.css` a mano, 183 líneas | Tailwind CSS con paleta `brand` propia |
| Tema | claro genérico | oscuro |
| Estructura JS | 2 scripts sueltos (135 líneas) | módulo IIFE compartido (329 líneas) |
| Estados de carga | ninguno | spinner + `disabled` durante la petición |
| Extras | — | tarjetas de métricas, badge «tú», botón actualizar, fechas en `es-MX` |

Sin estado de carga, el botón de login de `./Debil` admite pulsaciones repetidas: cada una lanza
una petición nueva.

### 4.2 Gestión de sesión en `localStorage`

| | `Debil` | `Fuerte` |
|---|---|---|
| Claves | `'token'`, `'user'` | `'auth_token'`, `'auth_user'` |
| Acceso | `localStorage` directo, disperso | objeto `storage` (`public/app.js:17-32`) |
| Parseo | `JSON.parse` sin protección (`public/js/dashboard.js:2`) | `try/catch` (`public/app.js:20-26`) |

Las claves genéricas de `./Debil` pueden colisionar con las de otra aplicación servida desde el
mismo origen. Y si el valor almacenado se corrompe, su `JSON.parse` lanza una excepción que rompe
la página entera, sin recuperación posible salvo limpiar el navegador a mano.

### 4.3 Guardia de ruta

`./Debil` (`public/js/dashboard.js:4-6`):

```js
if (!token) {
  window.location.href = '/login.html';
}
// el script CONTINÚA ejecutándose aquí
```

Faltan dos cosas. No hay `return`, así que el resto del script sigue corriendo contra un usuario
inexistente. Y `location.href` **deja entrada en el historial**: el botón «atrás» del navegador
devuelve a la vista protegida.

`./Fuerte` (`public/app.js:200-203`) usa `window.location.replace()` seguido de `return`.

### 4.4 Retroalimentación de errores

`./Debil` usa un `<div>` de texto rojo distinto por formulario (`login-error`, `register-error`,
`register-success`), cada uno manipulado a mano.

`./Fuerte` centraliza en `showAlert(tipo, mensaje)` (`public/app.js:35-48`) con tres variantes
—error, success, info— y estilos coherentes.

La diferencia más visible es la **sesión expirada**: `./Debil` detecta el 401 y redirige en
silencio (`public/js/dashboard.js:23-28`); el usuario aparece en el login sin saber por qué.
`./Fuerte` propaga el motivo por query string y lo muestra al llegar
(`public/app.js:219-225`, `309-315`).

### 4.5 Empate

Ambos escapan el HTML antes de pintar datos del servidor (`Debil/public/js/dashboard.js:53-57`,
`Fuerte/public/app.js:301-306`) usando la misma técnica de `textContent` → `innerHTML`. **Ninguno
de los dos es vulnerable a XSS** en la tabla de usuarios.

---

## Conclusión

Los dos proyectos funcionan. La diferencia no es si arrancan, sino **cuánto trabajo queda
pendiente antes de poder desplegarlos**.

El código de `./Fuerte` es un 86 % más extenso, pero ese volumen extra no es adorno: es
exactamente el trabajo que en `./Debil` tendrías que escribir tú después —logging, validación de
configuración, manejo de errores, documentación, estados de carga—. Y es trabajo que se pide
**una sola vez, en el prompt**, en lugar de descubrirse en cuatro o cinco rondas de «ahora
añádele…».

Los fallos de `./Debil` comparten una característica: **ninguno se detecta probando la aplicación**.
Se ve bonita, permite registrarse y entrar, y la tabla carga. El secreto JWT sin validar, la
ausencia de `try/catch` y los datos personales en el token solo se manifiestan en producción,
cuando ya son caros.
