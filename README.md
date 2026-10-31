# Macros de Julio

App personal de calorías y macros. Se instala en el teléfono desde GitHub Pages y usa Gemini (gratis) a través de un Worker de Cloudflare que guarda la API key.

```
Teléfono (GitHub Pages)  ──►  Worker de Cloudflare (guarda la key)  ──►  Gemini
datos en el teléfono          revisa tu clave personal
```

## Instalación (una sola vez, ~15 min)

### 1. API key de Gemini
1. Entra a https://aistudio.google.com con tu cuenta de Google.
2. **Get API key → Create API key**. Cópiala.
3. Revisa ahí mismo los límites del plan gratuito. En el plan gratis, Google puede usar lo que envías para mejorar sus productos.

### 2. Worker de Cloudflare (gratis)
1. Crea una cuenta en https://dash.cloudflare.com.
2. **Workers & Pages → Create → Create Worker**. Nómbralo `macros-julio` y toca **Deploy**.
3. **Edit code**: borra todo, pega el contenido de `worker/worker.js` y toca **Deploy**.
4. **Settings → Variables and Secrets → Add**:
   | Nombre | Tipo | Valor |
   |---|---|---|
   | `GEMINI_API_KEY` | Secret | tu key del paso 1 |
   | `APP_TOKEN` | Secret | una clave larga que inventes (20+ caracteres, sin espacios) |
   | `ALLOWED_ORIGINS` | Text | `https://TU-USUARIO.github.io` (sin `/` al final, sin el nombre del repo) |
   | `GEMINI_MODEL` | Text | opcional; por defecto `gemini-flash-latest` |
5. Anota la dirección del Worker: `https://macros-julio.TU-SUBDOMINIO.workers.dev`.

### 3. GitHub Pages
1. Sube esta carpeta a un repositorio (por ejemplo `macros-julio`).
2. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
3. En 1–2 minutos queda en `https://TU-USUARIO.github.io/macros-julio/`.

### 4. En el teléfono
1. Abre la dirección en **Chrome** (Android) o **Safari** (iPhone).
2. Android: menú ⋮ → **Instalar app**. iPhone: compartir → **Agregar a inicio**.
3. Abre la app desde el ícono **Macros**, completa los 4 pasos de tu plan.
4. **Ajustes → Conexión con Gemini**: pega la dirección del Worker y tu `APP_TOKEN` → **Probar conexión**.

## Funciones
- Registro por foto del plato (opcional: segunda foto con lo que sobró, y peso total), foto de la etiqueta, texto libre o manual.
- Recientes, favoritos y Mis platos (recetas con porciones). Editar, mover, copiar a hoy, repetir 7 días.
- Meta con 5 objetivos (Mifflin-St Jeor o Katch-McArdle si das tu % de grasa), metas propias, recordatorio para recalcular cada 15 días.
- Compensar excesos en los días siguientes, ahorrar para el sábado, días altos y bajos, actividad extra.
- Agua, ayuno intermitente que se cuenta solo, suplementos, fibra.
- Completa mi día y Plan de referencia con lista de compras (IA).
- Progreso: promedios de la semana, peso y % de grasa, medidas, % de grasa por medidas (fórmula de la Marina de EE. UU.) o por fotos (IA), resumen del mes y racha.

## Datos y respaldo
Todo queda guardado **solo en ese teléfono** (almacenamiento del navegador). Si borras los datos del navegador o cambias de teléfono, se pierde. Usa **Ajustes → Exportar respaldo** de vez en cuando e **Importar respaldo** en el teléfono nuevo.

## Seguridad
- La API key nunca está en el código de la app: vive como secreto en Cloudflare.
- El Worker solo responde a tu dirección de GitHub Pages y a quien tenga tu `APP_TOKEN`.
- Si sospechas que alguien tiene tu `APP_TOKEN`, cámbialo en Cloudflare y en Ajustes.

## Actualizar la app
Sube los cambios al repositorio. La app los toma la próxima vez que se abre con internet.
