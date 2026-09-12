import { describe, expect, it } from "vitest";

import { contiene } from "@/pages/texto";

/**
 * Qué encuentra un buscador de esta consola.
 *
 * Existe por un caso concreto: escribir "lucia" en Accounts no encontraba a
 * Lucía Otero, que estaba tres filas más abajo. Nadie pone las tildes en un
 * buscador —menos en un teléfono, donde la tilde es mantener apretada la
 * vocal— y los nombres de esta casa están llenos: Lucía, Martín, Sofía, Iván,
 * Andrés.
 *
 * Lo que se fija acá es que la comparación aplane los dos lados. Fijarlo
 * importa porque la tentación al tocar esto es normalizar sólo lo que se
 * escribe, y así "Lucía" sigue sin coincidir con nada.
 */

describe("buscar sin acentos", () => {
  it("encuentra un nombre acentuado escribiéndolo sin tildes", () => {
    expect(contiene(["Lucía Otero"], "lucia")).toBe(true);
    expect(contiene(["Martín Quiroga"], "martin")).toBe(true);
    expect(contiene(["Iván Palacios"], "ivan pala")).toBe(true);
  });

  it("también al revés: lo escrito con tilde encuentra lo que no la tiene", () => {
    expect(contiene(["Ana Lupo"], "ána")).toBe(true);
  });

  it("la ñ se aplana, que es lo que un buscador quiere", () => {
    expect(contiene(["Mañana a las nueve"], "manana")).toBe(true);
  });

  it("ignora mayúsculas, como antes", () => {
    expect(contiene(["USR-1042"], "usr-1042")).toBe(true);
  });

  it("busca en todos los textos que le pasan, y sigue diciendo que no", () => {
    expect(contiene(["Camila Ferreyra", "USR-1042"], "1042")).toBe(true);
    expect(contiene(["Camila Ferreyra", "USR-1042"], "bruno")).toBe(false);
  });
});
