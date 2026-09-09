import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { bind } from "cuelume";

import { nodosCreados, reiniciarAudio } from "./audio-falso";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import {
  SidebarMenuAction,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { COMO_INTERRUPTOR } from "@/stores/sonido";

/**
 * Cuántas veces suena un control por un gesto, y disparado por qué evento.
 *
 * Esto existe por un bug concreto: `Button` traía las dos mitades del gesto
 * —`data-cuelume-press` al bajar el dedo y `data-cuelume-release` al subirlo—
 * y eso hacía que **un clic sonara dos veces**, que el segundo sonido llegara
 * tan tarde como durara el apretón, y que ningún clic sonara igual al anterior.
 * Tres síntomas de una causa.
 *
 * El arreglo fue anclar todo al `pointerdown`. Lo que este archivo cuida es que
 * eso no se deshaga: cualquiera que vuelva a agregar un `release`, o que mueva
 * una señal al `click`, rompe un test acá.
 *
 * Se corre `bind()` de verdad y se cuenta sobre un `AudioContext` de mentira
 * —ver `audio-falso`—: lo que se prueba es el cableado real de `cuelume` contra
 * el markup real de los componentes, no un doble de ninguno de los dos.
 */

beforeAll(() => {
  /* Una sola vez, como en `main`. `bind()` es idempotente por raíz y delegado
     en el documento, así que alcanza a todo lo que se monte después. */
  bind();
});

beforeEach(() => {
  cleanup();
  reiniciarAudio();
});

/* Un gesto de puntero, evento por evento.
 *
 * Devuelve qué eventos hicieron sonar algo y cuánto. La cuenta es por evento y
 * no por tiempo transcurrido a propósito: agrupar por cercanía fue lo que hizo
 * que la primera versión de esta sonda no viera el bug —un `pointerdown` y un
 * `pointerup` despachados juntos parecían un solo sonido—. */
function cuesPorEvento(el: Element) {
  const cuenta: Record<string, number> = {};
  const disparar = (tipo: string, ev: Event) => {
    const antes = nodosCreados();
    el.dispatchEvent(ev);
    const nodos = nodosCreados() - antes;
    if (nodos > 0) cuenta[tipo] = nodos;
  };

  const puntero = (tipo: string) =>
    new PointerEvent(tipo, {
      pointerType: "mouse",
      bubbles: true,
      cancelable: true,
      isPrimary: true,
    });

  disparar("pointerover", puntero("pointerover"));
  disparar("pointerenter", puntero("pointerenter"));
  disparar("pointerdown", puntero("pointerdown"));
  disparar("pointerup", puntero("pointerup"));
  disparar("click", new MouseEvent("click", { bubbles: true, cancelable: true }));

  return cuenta;
}

/** Los eventos que sonaron, en orden. */
const sonaronEn = (el: Element) => Object.keys(cuesPorEvento(el));

describe("un gesto, un sonido", () => {
  it("un Button suena una sola vez, y en el pointerdown", () => {
    const { getByRole } = render(<Button>Guardar</Button>);
    expect(sonaronEn(getByRole("button"))).toEqual(["pointerdown"]);
  });

  it("un Button no vuelve a sonar al soltar ni al hacer click", () => {
    /* El bug, escrito como test. Si alguien devuelve `data-cuelume-release`,
       acá aparece un `pointerup` y esto se pone en rojo. */
    const { getByRole } = render(<Button>Guardar</Button>);
    const cuenta = cuesPorEvento(getByRole("button"));
    expect(cuenta.pointerup).toBeUndefined();
    expect(cuenta.click).toBeUndefined();
  });

  it("un control que alterna suena en el pointerdown, no en el click", () => {
    /* `COMO_INTERRUPTOR` conserva el click-clack pero lo pide desde el atributo
       `press`. Con `data-cuelume-toggle` sonaría en el `click`, que el navegador
       emite recién en el `pointerup` —el mismo atraso variable, por otra vía—. */
    const { getByRole } = render(
      <Button {...COMO_INTERRUPTOR}>Tema</Button>,
    );
    expect(sonaronEn(getByRole("button"))).toEqual(["pointerdown"]);
  });

  it("el default se puede apagar desde el call site", () => {
    const { getByRole } = render(
      <Button {...{ "data-cuelume-press": undefined }}>Mudo</Button>,
    );
    expect(sonaronEn(getByRole("button"))).toEqual([]);
  });

  it("un Button deshabilitado no suena", () => {
    /* Un control que no puede hacer nada no debería avisar que hizo algo. Lo
       garantiza el navegador —no despacha eventos de puntero sobre un
       `<button disabled>`— y no nuestro código, así que se deja anotado: si
       algún día `Button` dejara de usar el `disabled` nativo, esto avisa. */
    const { getByRole } = render(<Button disabled>Guardar</Button>);
    expect((getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("cada señal en su lugar", () => {
  it("ningún control pide dos señales a la vez", () => {
    /* Dos atributos en el mismo elemento son dos sonidos por gesto. Es la forma
       general del bug, más allá del par `press`/`release` que lo causó. */
    const { container } = render(
      <>
        <Button>Común</Button>
        <Button {...COMO_INTERRUPTOR}>Alterna</Button>
        <Button data-cuelume-press="page">Página</Button>
      </>,
    );

    for (const el of container.querySelectorAll("*")) {
      const señales = [...el.attributes]
        .map((a) => a.name)
        .filter((n) => n.startsWith("data-cuelume-"));
      expect(señales.length, `${el.tagName} pide ${señales.join(" + ")}`).toBeLessThan(2);
    }
  });

  it("el call site elige la señal y el default no se la pisa", () => {
    const { getByRole } = render(<Button data-cuelume-press="page">Siguiente</Button>);
    expect(getByRole("button").getAttribute("data-cuelume-press")).toBe("page");
  });
});

describe("el vocabulario de señales", () => {
  /* Cada control de la app dice una cosa distinta y la dice con una señal
     distinta. Esto fija el mapa: si alguien cambia una, se entera acá y no
     escuchando la app. Las señales son de `cuelume` y el criterio es suyo —
     `tick` para navegar, `page` para pasar de hoja, `droplet` para descartar—;
     lo que este test cuida es que cada control siga eligiendo la que le toca. */

  it("una fila del sidebar tickea: lleva a otro lado", () => {
    const { getByRole } = render(<SidebarMenuButton>Cuentas</SidebarMenuButton>);
    const fila = getByRole("button");
    expect(fila.getAttribute("data-cuelume-press")).toBe("tick");
    expect(sonaronEn(fila)).toEqual(["pointerdown"]);
  });

  it("la acción de la fila golpea: hace algo, no lleva a ningún lado", () => {
    const { getByRole } = render(
      <SidebarMenuAction aria-label="Abrir otra">+</SidebarMenuAction>,
    );
    const accion = getByRole("button");
    /* Vacío es "la señal por defecto", que para `press` es el knock. */
    expect(accion.getAttribute("data-cuelume-press")).toBe("");
    expect(sonaronEn(accion)).toEqual(["pointerdown"]);
  });

  it("las dos flechas de la paginación suenan a papel", () => {
    const { getByLabelText } = render(
      <Pagination total={5} value={2} />,
    );

    for (const etiqueta of ["Previous page", "Next page"]) {
      const flecha = getByLabelText(etiqueta);
      expect(
        flecha.getAttribute("data-cuelume-press"),
        `${etiqueta} debería sonar a papel`,
      ).toBe("page");
      /* En la página 2 las dos están habilitadas, así que las dos suenan. */
      expect(sonaronEn(flecha), etiqueta).toEqual(["pointerdown"]);
    }
  });

  it("una flecha que no lleva a ninguna parte no suena", () => {
    /* En la página 1 la de atrás está deshabilitada. Acá el evento se despacha
       a mano —un test no tiene puntero de verdad— así que lo que se comprueba
       es el `disabled`, que es lo que hace que el navegador no despache nada. */
    const { getByLabelText } = render(
      <Pagination total={5} value={1} />,
    );
    expect((getByLabelText("Previous page") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
