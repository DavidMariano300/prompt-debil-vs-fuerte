# Los prompts

Este es el artefacto central del experimento: las dos instrucciones que produjeron
[`./Debil`](Debil) y [`./Fuerte`](Fuerte).

> ⚠️ **PENDIENTE — rellenar.** Los prompts originales no están transcritos todavía. Pega abajo el
> texto **literal** de cada uno, tal como se envió al modelo. No los reescribas ni los mejores al
> copiarlos: el valor del repositorio depende de que sean fieles.

---

## Prompt débil → `./Debil`

```text
[PEGAR AQUÍ EL PROMPT LITERAL]
```

---

## Prompt fuerte → `./Fuerte`

```text
[PEGAR AQUÍ EL PROMPT LITERAL]
```

---

## Qué separa a uno del otro

Esta sección **no** describe los prompts originales: es la generalización extraída de comparar
los dos resultados. Sirve como lista de verificación reutilizable.

Un prompt débil describe **qué debe hacer** el software. Un prompt fuerte describe además **bajo
qué condiciones se considera terminado**. Los criterios que marcaron la diferencia, ordenados por
impacto observado:

| Criterio | Si no se pide… | Si se pide… |
|---|---|---|
| **Logging** | 1 línea en todo el backend | 37 sentencias con prefijos filtrables |
| **Validación de configuración** | arranca roto y falla en el primer login | `exit(1)` con mensaje claro al arrancar |
| **Manejo de errores** | 0 `try/catch`; se filtra el stack trace | cobertura por endpoint + middleware central |
| **Documentación** | ninguna | README con endpoints, variables y ejemplos |
| **Estados de la interfaz** | el botón admite pulsaciones repetidas | spinner y `disabled` durante la petición |
| **Mensajes al usuario** | redirección silenciosa al expirar la sesión | se explica el motivo |
| **Ciclo de vida** | sin manejo de puerto ocupado ni cierre limpio | `EADDRINUSE` explicado y `SIGINT` ordenado |

### La regla

El modelo cumple el contrato que le escribes, no el que tienes en la cabeza. Todo estándar de
calidad que dejes implícito —porque «se da por supuesto» o «cualquier desarrollador lo haría»—
tiene alta probabilidad de no aparecer.

Formulado como criterios verificables, un prompt fuerte responde a: ¿qué se registra en consola y
con qué formato? ¿qué pasa si falta una variable de entorno? ¿qué ve el usuario cuando algo falla?
¿qué documentación acompaña al código? ¿qué ocurre al cerrar el proceso?

### Un matiz honesto

Un prompt más largo no es automáticamente mejor. En organización de carpetas el resultado débil
quedó **mejor estructurado** (`routes/`, `middleware/`, `db/`) que el fuerte, que concentra todo
en un `server.js` de 213 líneas. Ningún criterio de arquitectura estaba explícito en el prompt
fuerte, y ahí el resultado fue peor. Lo cual refuerza la tesis en lugar de contradecirla:
**se obtiene aquello que se especifica**.
