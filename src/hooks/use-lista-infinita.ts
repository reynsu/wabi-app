import { useCallback, useEffect, useState } from "react";

/**
 * Una lista que se sigue en vez de paginarse: un centinela al final y un
 * observer que pide el próximo tramo cuando se acerca.
 *
 * Es la otra respuesta a "son demasiadas filas para pintarlas todas", y cuál va
 * en cada lado no es lo mismo: el pager es de escritorio, donde hay un pie
 * fijo, un teclado para saltar a la página siete y un "de cuántos" que ubica; en
 * un teléfono el pulgar ya está haciendo el gesto de seguir bajando, y cortarlo
 * cada cuarenta filas para tocar una flecha de 36px es pedirle que cambie de
 * modo para hacer lo que estaba haciendo.
 *
 * Vive acá, al lado de `use-paginacion`, porque son las dos mitades de la misma
 * decisión y hay pantallas —Chat Search— que usan una en cada resolución.
 *
 * La `clave` es lo que estaba filtrado cuando la ventana creció: cambiarla la
 * devuelve a un tramo. Se ajusta al derivar y no en un efecto, así no se pintan
 * cuarenta filas que ya no corresponden para borrarlas después. Es el mismo
 * patrón que usa `Pagination` para saber desde qué dígito rueda.
 */

/** Cuántas filas se agregan cada vez que el final entra en pantalla. */
const PASO = 12;

/* La caja que scrollea, buscada subiendo desde el centinela. Se la busca en
   vez de nombrar al panel de la pestaña: una pantalla no tiene por qué saber
   quién la está conteniendo, y así funciona igual el día que la metan en un
   diálogo o en el riel del costado. */
function scrollerDe(el: HTMLElement | null) {
  for (let padre = el?.parentElement; padre; padre = padre.parentElement) {
    const desborde = getComputedStyle(padre).overflowY;
    if (desborde === "auto" || desborde === "scroll") return padre;
  }
  return null;
}

export function useListaInfinita<T>(todos: T[], clave: string, paso = PASO) {
  const [ventana, setVentana] = useState({ clave, cuantas: paso });
  const cuantas = ventana.clave === clave ? ventana.cuantas : paso;
  if (ventana.clave !== clave) setVentana({ clave, cuantas: paso });

  const filas = todos.slice(0, cuantas);
  const quedan = cuantas < todos.length;

  /** Va al final de la lista. Sin montarlo no hay scroll infinito: es lo que el
   *  observer mira, así que una pantalla que sólo lo pone en el teléfono deja
   *  esto quieto en escritorio sin tener que apagarlo.
   *
   *  Es un ref de función y el nodo va a estado, no a `useRef`. Con un ref
   *  común, el efecto que arma el observer lo lee al montarse y no se entera
   *  nunca más: una pantalla que empieza sin centinela —Chat Search dibuja la
   *  tabla en el primer pintado y la lista recién cuando `useEsMovil` contesta—
   *  lo encontraba en `null`, salía temprano, y como sus dependencias no
   *  cambiaban no volvía a intentarlo. La lista se quedaba en el primer tramo
   *  para siempre. Con el nodo en estado, montarlo *es* un cambio. */
  const [nodo, setNodo] = useState<HTMLDivElement | null>(null);
  const centinela = useCallback((el: HTMLDivElement | null) => setNodo(el), []);

  /* Cambiar lo filtrado vuelve arriba. Sin esto, filtrar desde el fondo de la
     lista deja la vista a la altura de la fila 40 de un resultado que recién
     empieza, y el centinela —que sigue ahí abajo— pide tramo tras tramo hasta
     alcanzarla: con una API detrás, media tabla traída para nada. */
  useEffect(() => {
    scrollerDe(nodo)?.scrollTo({ top: 0 });
  }, [clave, nodo]);

  useEffect(() => {
    const el = nodo;
    if (!el || !quedan) return;

    /* La raíz es la caja que scrollea y no el viewport: contra el viewport el
       `rootMargin` no sirve de nada, porque un ancestro que recorta deja al
       centinela fuera de la intersección aunque caiga adentro del margen, y el
       tramo llegaba recién al tocar fondo.

       Sin mirar si la pestaña está a la vista. Lo miraba —una pestaña que no
       estás mirando sigue montada, escondida con `visibility`, y un
       IntersectionObserver no se entera— y el remedio era peor: la que arranca
       escondida se quedaba con el primer tramo **para siempre**, porque cuando
       la mirás no cambia ninguna intersección y nadie vuelve a preguntar. Con
       doce filas que llenan la pantalla justo, no había ni scroll con el que
       destrabarla: doce cuentas de cuarenta y ocho, y se acabó.

       Y lo que evitaba era chico: escondida o no, el relleno se detiene igual
       —en cuanto el contenido pasa el alto del scroller más el margen, el
       centinela sale de cuadro—, así que una pestaña en segundo plano se trae
       dos tramos, no la tabla. */
    const scroller = scrollerDe(el);

    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        setVentana((v) =>
          v.clave === clave ? { ...v, cuantas: v.cuantas + paso } : v,
        );
      },
      // Pide el tramo antes de llegar al final, así la lista no se corta.
      { root: scroller, rootMargin: "240px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
    /* `cuantas` va en las dependencias aunque el efecto no lo lea: un
       IntersectionObserver avisa cuando la intersección *cambia*, y después de
       agregar un tramo el centinela sigue visible, así que no vuelve a avisar
       nunca. Rearmando el observer se lo pregunta de nuevo, y la lista se
       sigue llenando hasta tapar la pantalla —que es donde el centinela por
       fin sale de cuadro y esto se queda quieto esperando que scrollees. */
  }, [clave, quedan, cuantas, paso, nodo]);

  return { filas, centinela, quedan };
}
