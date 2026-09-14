---
name: publicar
description: Commitear, pushear a main y publicar la GitHub Page de wabi-app. Úsalo cuando el usuario diga "haz el commit", "commitea", "pushea", "actualiza la github page", "publicá esto" o cualquier combinación de las tres. Incluye las verificaciones que van antes, cómo se parten los commits, cómo se escriben los mensajes de esta casa y cómo se confirma que el deploy salió.
---

# Publicar

Tres cosas, en este orden: **verificar, commitear, publicar**. Ninguna se saltea, y
la primera es la que más veces encontró algo.

## 1. Verificar

Las cuatro, siempre, antes de tocar `git`:

```bash
npx tsc -b && npx oxlint src && npx vitest run && npm run build
```

`oxlint` no falla la build cuando avisa, así que **se leen sus warnings**: en esta
casa el árbol está limpio, y un `react(refs)` o un `react(set-state-in-effect)`
nuevo es una decisión mal tomada, no ruido. Si aparece uno, se arregla antes de
commitear.

Si algo falla, **no se commitea**: se dice qué falló, con la salida.

## 2. Commitear

**Se parte por lo que es, no por archivo.** Un cambio que toca un componente
compartido y una pantalla son dos commits: el componente lo van a encontrar hecho
las otras cinco pantallas, y quien lea la historia quiere leer esa decisión sola.
Dos cambios de la misma pantalla, en cambio, van juntos aunque toquen tres
archivos.

Si dos cosas viven en el mismo archivo, se parte por hunks —`git diff > /tmp/x.patch`,
se separa el hunk y `git apply --cached`— y se comprueba que **cada commit compile
solo**: `npx tsc -b` entre uno y otro.

### El mensaje

El asunto es **una frase en castellano que dice qué pasó**, no un prefijo. Así se
ve la historia de este repo:

```
Un buzón, en un teléfono, son tres renglones
La hoja no se asoma: ocupa la pantalla
"lucia" tiene que encontrar a Lucía
Una barra que se aparta del puntero, en algo que no tiene puntero
```

Nada de `feat:`, `fix:` ni `chore:`.

El cuerpo explica **por qué**, no qué: los números que motivaron el cambio ("a la
columna de Status le tocaban 37 píxeles"), lo que se probó y se descartó, lo que
el cambio cuesta y qué lo compensa. Si el cambio destapó un bug, se cuenta cómo se
reproduce. Negritas de markdown para las dos o tres afirmaciones que sostienen el
commit.

Termina con:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Se escribe con un heredoc, que es lo único que respeta los acentos y los saltos:

```bash
git add -A && git commit -q -F - <<'MSG'
El asunto, en una línea

El cuerpo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

### Lo que no va a `main`

Los prototipos. Viven en una rama `prototipo/<qué-se-probó>` con todas sus
variantes y el veredicto en el mensaje, y **no se mergean**: son la fuente. En
`main` queda sólo la variante que ganó, escrita como corresponde. Ver
`prototipo/fila-buzon` y `prototipo/fila-cuenta`.

## 3. Publicar

El push a `main` dispara el deploy solo —ver `.github/workflows/pages.yml`—, así
que publicar es pushear y mirar que haya salido:

```bash
git push origin main
```

```bash
sleep 15 && gh run list --workflow=pages.yml --limit 1 --json databaseId,status,headSha
```

Con el `databaseId` de esa corrida —y confirmando que su `headSha` es el commit
que se acaba de pushear—:

```bash
gh run watch <id> --exit-status && gh run view <id> --json conclusion
```

Y por último, que el sitio conteste:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://reynsu.github.io/wabi-app/
```

Un 200 y `"conclusion":"success"` son las dos cosas que hay que ver antes de decir
que está publicado. El `gh run watch` tarda un par de minutos: se espera, no se
adivina.

## Al terminar

Se reporta, en este orden: qué commits se hicieron y por qué son ésos, el rango
que se pusheó, el resultado del workflow con su enlace, y el código del sitio.

Y si algo quedó sin verificar —un gesto que el panel del navegador no puede
ejercitar, un portapapeles que el navegador embebido deniega—, **se dice**, con
qué habría que probar en el teléfono.
