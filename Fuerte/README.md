# Autenticación JWT + Dashboard de Usuarios

Aplicación web full stack con Express, SQLite, JWT y Tailwind CSS.

## Puesta en marcha

```bash
npm install && npm start
```

Abre <http://localhost:3003>. La base de datos `database.sqlite` se crea sola en el primer arranque.

## Variables de entorno (`.env`)

| Variable         | Descripción                          | Valor por defecto |
| ---------------- | ------------------------------------ | ----------------- |
| `PORT`           | Puerto del servidor                  | `3003`            |
| `JWT_SECRET`     | Clave para firmar los tokens         | —                 |
| `JWT_EXPIRES_IN` | Vigencia del token                   | `1h`              |

> Cambia `JWT_SECRET` por un valor largo y aleatorio antes de desplegar en producción.

## Endpoints

| Método | Ruta            | Protegido | Descripción                                        |
| ------ | --------------- | --------- | -------------------------------------------------- |
| `POST` | `/api/register` | No        | Crea un usuario (contraseña hasheada con bcrypt).   |
| `POST` | `/api/login`    | No        | Valida credenciales y devuelve un JWT.              |
| `GET`  | `/api/users`    | Sí        | Lista de usuarios, sin el campo `password`.         |
| `GET`  | `/api/me`       | Sí        | Datos del usuario autenticado.                      |

Las rutas protegidas requieren la cabecera `Authorization: Bearer <token>`.

### Ejemplo

```bash
curl -X POST http://localhost:3003/api/register -H 'Content-Type: application/json' -d '{"username":"david","password":"secreta123"}'
```

## Estructura

```
├── server.js            API REST, logging HTTP y archivos estáticos
├── database.js          Conexión SQLite y consultas de usuarios
├── middleware/auth.js   Verificación del JWT
├── public/
│   ├── index.html       Login / Registro
│   ├── dashboard.html   Vista protegida
│   └── app.js           Lógica del frontend (compartida)
└── .env                 Configuración
```

## Logging en consola

El servidor imprime cada interacción:

```
[2026-09-10T16:09:45.448Z] [POST] [/api/register] - ::1
[DATABASE] Consulta ejecutada: INSERT INTO users (username = 'david')
[REGISTRO] Usuario creado exitosamente: david (ID: 1)
[AUTH] Login exitoso para david -> JWT Generado
[AUTH ERROR] Intento de login fallido para david (Contraseña/Usuario incorrecto)
[SECURITY] Token válido para usuario: david
[SECURITY ALERT] Intento de acceso no autorizado a /api/users (Token inválido o ausente)
```

## Notas

- Las contraseñas se hashean con `bcryptjs` y salt de 10 rondas; nunca se almacenan ni se devuelven en texto plano.
- El token se guarda en `localStorage`. Si expira, el dashboard cierra la sesión y redirige al login.
- Si el puerto está ocupado, el servidor lo avisa y termina; cambia `PORT` en `.env`.
