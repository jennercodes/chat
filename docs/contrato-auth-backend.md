# Contrato de autenticación — Frontend ↔ Backend

> Mensaje para el equipo de backend. El frontend ya tiene el flujo de
> login/logout funcionando contra un backend **simulado**; este documento
> propone el contrato real a confirmar/alinear.
>
> Fecha: 2026-06-22 · Estado: **propuesta, pendiente de confirmación del backend**

---

Hola equipo 👋

Ya tenemos el frontend del chat con el **flujo de login/logout funcionando**
contra un backend simulado. Antes de conectar contra el servicio real, queremos
alinear el contrato de autenticación. Lo construimos de forma aislada, así que
adaptarlo a lo que ustedes definan es de bajo costo.

## 1. Estrategia de tokens (importante para ustedes)

Usamos **JWT Bearer + refresh token** con un patrón **BFF** (Backend-For-Frontend):
nuestro propio servidor web hace de intermediario.

- El **access token** vive en memoria en el navegador.
- El **refresh token** lo guardamos nosotros en una **cookie `httpOnly`** desde el
  BFF (el JS del navegador nunca lo ve).
- **Las llamadas de auth son servidor-a-servidor** (nuestro BFF → su API), así que
  **no necesitan configurar CORS** para esto.

👉 Esto implica dos cosas que necesitamos de su lado:

- Que sus endpoints **devuelvan los tokens en el cuerpo JSON** de la respuesta (no
  por `Set-Cookie`). La cookie la gestionamos nosotros.
- Que `/auth/refresh` **acepte el refresh token como parámetro** (campo en el
  body), porque la cookie la administra nuestro BFF, no ustedes.

## 2. Endpoints propuestos

| Método | Ruta            | Descripción                             |
| ------ | --------------- | --------------------------------------- |
| POST   | `/auth/login`   | Login con credenciales                  |
| POST   | `/auth/refresh` | Nuevo access token a partir del refresh |
| POST   | `/auth/logout`  | Revoca el refresh token                 |

## 3. Formas de datos que asumimos hoy (ajústenlas si difieren)

```jsonc
// POST /auth/login  (request)
{ "email": "user@example.com", "password": "••••••" }

// POST /auth/login  (response)
{
  "accessToken": "<jwt>",
  "refreshToken": "<token>",
  "expiresIn": 900,                         // segundos de vida del access token
  "user": { "id": "u1", "displayName": "Ana", "avatarUrl": null }
}

// POST /auth/refresh  (request)
{ "refreshToken": "<token>" }

// POST /auth/refresh  (response)  -> mismo shape que login
{ "accessToken": "<jwt>", "refreshToken": "<token>", "expiresIn": 900,
  "user": { "id": "u1", "displayName": "Ana", "avatarUrl": null } }
```

Nota: incluir `user` también en la respuesta de `/auth/refresh` nos evita una
llamada extra. Si prefieren un `/auth/me` aparte, también nos sirve — solo
confírmennos cuál.

## 4. Preguntas concretas a confirmar

1. ¿Tiempos de expiración del **access** y del **refresh**? ¿El refresh **rota** en
   cada uso?
2. ¿Forma exacta de las respuestas de `login` y `refresh`? ¿Y el `user` viaja ahí o
   hace falta `/auth/me`?
3. ¿Qué **claims** trae el JWT que el frontend pueda usar (id, nombre, avatar)?
4. ¿`/auth/refresh` recibe el refresh token en el **body**, en un header, o cómo lo
   prefieren?
5. **Formato de error** (p. ej. credenciales inválidas / token expirado): ¿código
   HTTP y shape del JSON?
6. **URLs por entorno** (dev / staging / prod).

Con eso conectamos el frontend real en poco tiempo. ¡Gracias! 🙌

---

> El **WebSocket** (autenticación de la conexión por _ticket_ y formato de
> mensajes) lo coordinaremos en un documento aparte para la siguiente fase.
