import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { useTecladoDeTabla } from "@/pages/tabla-teclado";

/**
 * Que las tablas de la consola se puedan recorrer con el teclado.
 *
 * Esto existe por dos razones. La primera es la de siempre: lo que no está
 * escrito como test se deshace. La segunda es más puntual —el teclado se
 * engancha **desde afuera** del componente `Table`, que baja del registry
 * @fluid y no es nuestro (ver `tabla-teclado`)—, y lo único que hace que
 * enganche es que `TableRow` reparta al `<tr>` las props que no conoce. El día
 * que una actualización del registry deje de hacerlo, las filas se quedan sin
 * `tabindex` y la tabla deja de recorrerse; lo que sigue se pone en rojo
 * primero.
 */

/* A mano y no automático: `globals` está apagado en `vitest.config`, así que
   `@testing-library` no engancha su propia limpieza y las tablas de un test se
   quedarían montadas en el siguiente. */
afterEach(cleanup);

const CUENTAS = ["Ana", "Bruno", "Carla", "Delia"];

function TablaDePrueba({ onActivar }: { onActivar?: (i: number) => void }) {
  const teclado = useTecladoDeTabla({ cuantas: CUENTAS.length, onActivar });

  return (
    <Table {...teclado.tabla}>
      <TableBody>
        {CUENTAS.map((cuenta, i) => (
          <TableRow key={cuenta} index={i} {...teclado.fila(i)}>
            <TableCell>{cuenta}</TableCell>
            <TableCell>
              <button type="button">Abrir {cuenta}</button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Las filas del cuerpo, en orden. */
function filasDe(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLTableRowElement>("tbody tr")];
}

/** En qué fila está el foco, o `-1` si no está en ninguna. */
function filaEnfocada(container: HTMLElement) {
  return filasDe(container).indexOf(
    document.activeElement as HTMLTableRowElement,
  );
}

/** Qué fila es la parada de tabulado: la única con `tabindex="0"`. */
function paradaDeTabulado(container: HTMLElement) {
  const paradas = filasDe(container).filter(
    (fila) => fila.getAttribute("tabindex") === "0",
  );
  expect(paradas.length, "hay una sola parada de tabulado").toBe(1);
  return filasDe(container).indexOf(paradas[0]);
}

describe("una parada de tabulado, y las flechas adentro", () => {
  it("la tabla entera entra con un solo Tab", () => {
    /* Es la diferencia con lo que había: sin esto el `Tab` recorría los
       controles de cada fila —dos por fila acá, ochenta en una lista de
       cuarenta buzones— y la fila no era una parada. */
    const { container } = render(<TablaDePrueba />);
    expect(paradaDeTabulado(container)).toBe(0);
    for (const fila of filasDe(container)) {
      expect(fila.getAttribute("tabindex")).not.toBeNull();
    }
  });

  it("las flechas bajan y suben de a una fila", () => {
    const { container } = render(<TablaDePrueba />);
    const filas = filasDe(container);

    filas[0].focus();
    fireEvent.keyDown(filas[0], { key: "ArrowDown" });
    expect(filaEnfocada(container)).toBe(1);

    fireEvent.keyDown(filas[1], { key: "ArrowDown" });
    expect(filaEnfocada(container)).toBe(2);

    fireEvent.keyDown(filas[2], { key: "ArrowUp" });
    expect(filaEnfocada(container)).toBe(1);
  });

  it("la parada de tabulado se queda donde quedó el foco", () => {
    /* Salir de la tabla y volver con `Tab` tiene que devolver a la fila en la
       que uno estaba, no a la primera. */
    const { container } = render(<TablaDePrueba />);
    const filas = filasDe(container);

    filas[0].focus();
    fireEvent.keyDown(filas[0], { key: "ArrowDown" });
    fireEvent.keyDown(filas[1], { key: "ArrowDown" });

    expect(paradaDeTabulado(container)).toBe(2);
  });

  it("las flechas no se salen de la lista por ninguna de las dos puntas", () => {
    const { container } = render(<TablaDePrueba />);
    const filas = filasDe(container);

    filas[0].focus();
    fireEvent.keyDown(filas[0], { key: "ArrowUp" });
    expect(filaEnfocada(container)).toBe(0);

    filas[3].focus();
    fireEvent.keyDown(filas[3], { key: "ArrowDown" });
    expect(filaEnfocada(container)).toBe(3);
  });

  it("Inicio y Fin van a las puntas", () => {
    const { container } = render(<TablaDePrueba />);
    const filas = filasDe(container);

    filas[1].focus();
    fireEvent.keyDown(filas[1], { key: "End" });
    expect(filaEnfocada(container)).toBe(3);

    fireEvent.keyDown(filas[3], { key: "Home" });
    expect(filaEnfocada(container)).toBe(0);
  });
});

describe("qué hace Enter", () => {
  it("cuando la fila entera hace algo, la activa —y el espacio también", () => {
    const activar = vi.fn();
    const { container } = render(<TablaDePrueba onActivar={activar} />);
    const filas = filasDe(container);

    filas[2].focus();
    fireEvent.keyDown(filas[2], { key: "Enter" });
    expect(activar).toHaveBeenCalledWith(2);

    fireEvent.keyDown(filas[2], { key: " " });
    expect(activar).toHaveBeenCalledTimes(2);
  });

  it("cuando no, mete el foco en el primer control de la fila", () => {
    /* La otra mitad de recorrer una tabla: llegar a lo que la fila tiene
       adentro sin tabular por todas las filas anteriores. */
    const { container } = render(<TablaDePrueba />);
    const filas = filasDe(container);

    filas[1].focus();
    fireEvent.keyDown(filas[1], { key: "Enter" });
    expect(document.activeElement?.textContent).toBe("Abrir Bruno");
  });

  it("y Escape devuelve el foco a la fila", () => {
    const { container } = render(<TablaDePrueba />);
    const filas = filasDe(container);

    filas[1].focus();
    fireEvent.keyDown(filas[1], { key: "Enter" });
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(filaEnfocada(container)).toBe(1);
  });
});

describe("adentro de un control, las teclas son suyas", () => {
  it("una flecha en un botón de la fila no mueve la lista", () => {
    /* El caso que rompe una tabla escrita a lo bruto: las flechas adentro de un
       campo mueven el cursor del campo, no la fila. Acá el control es un botón
       —el disparador de una ficha— y lo que se cuida es lo mismo: que el
       handler de la tabla no le pise las teclas a lo que tiene adentro. */
    const { container, getByText } = render(<TablaDePrueba />);
    const boton = getByText("Abrir Bruno");

    boton.focus();
    fireEvent.keyDown(boton, { key: "ArrowDown" });

    expect(document.activeElement).toBe(boton);
    expect(filaEnfocada(container)).toBe(-1);
  });
});
