/**
 * PROTOTIPO — se tira. Rama `prototipo/shell-movil`.
 *
 * Variantes del shell móvil de la opción "el modelo sí, la barra no",
 * sobre la app de verdad (sidebar, tienda de pestañas, boards), conmutables con
 * `?variant=A…L|actual` y la tira de arriba (← → en el teclado). Sólo por
 * debajo de 768px y sólo en `vite dev`. El contenido de las secciones se
 * ignora: cada pestaña muestra un relleno con filas que abren detalles, para
 * poder apilar y volver.
 */

import { VarianteA } from "./variante-a";
import { VarianteB } from "./variante-b";
import { VarianteC } from "./variante-c";
import { VarianteD } from "./variante-d";
import { VarianteE } from "./variante-e";
import { VarianteF } from "./variante-f";
import { VarianteG } from "./variante-g";
import { VarianteH } from "./variante-h";
import { VarianteI } from "./variante-i";
import { VarianteJ } from "./variante-j";
import { VarianteK } from "./variante-k";
import { VarianteL } from "./variante-l";
import { InicioLista } from "./inicio-1";
import { InicioContinuar } from "./inicio-2";
import { InicioPulgar } from "./inicio-3";
import { InicioBento } from "./inicio-4";
import { useHistorialProto, type Variante } from "./historial";

export { ConmutadorProto } from "./comun";
export { useVariante } from "./historial";

export function ShellMovilPrototipo({ variante }: { variante: Exclude<Variante, "actual"> }) {
  useHistorialProto();
  if (variante === "B") return <VarianteB />;
  if (variante === "C") return <VarianteC />;
  if (variante === "D") return <VarianteD />;
  if (variante === "E") return <VarianteE />;
  if (variante === "F") return <VarianteF />;
  if (variante === "G") return <VarianteG />;
  if (variante === "H") return <VarianteH />;
  if (variante === "I") return <VarianteI />;
  if (variante === "J") return <VarianteJ />;
  // Mismo shell que J, otro Inicio. La `key` hace que cambiar de una a otra
  // vuelva a abrir Inicio en vez de heredar si estaba cerrado.
  if (variante === "J1") return <VarianteJ key="J1" hub={InicioLista} />;
  if (variante === "J2") return <VarianteJ key="J2" hub={InicioContinuar} />;
  if (variante === "J3") return <VarianteJ key="J3" hub={InicioPulgar} />;
  if (variante === "J4") return <VarianteJ key="J4" hub={InicioBento} />;
  if (variante === "K") return <VarianteK />;
  if (variante === "L") return <VarianteL />;
  return <VarianteA />;
}
