import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import type { WorkspaceTab } from "@/components/workspace-panel";
import { useWorkspace } from "@/stores/workspace";
import {
  irAInicio,
  mostrar,
  useHistorialMovil,
  useNavegacionMovil,
  volver,
} from "@/movil/navegacion";

/**
 * Atrás en el teléfono: que cada lugar sea una entrada del historial y que
 * volver ponga adelante la de esa entrada.
 *
 * Es la parte del shell móvil más fácil de romper sin que se vea —todo sigue
 * andando hasta que alguien toca atrás y sale de la app, o vuelve a algo que
 * cerró—, y la que el router va a reemplazar: estos casos son lo que el
 * reemplazo tiene que seguir cumpliendo.
 *
 * El árbol real se cambia por uno de dos hojas: `navigation` importa todas las
 * pantallas, y lo único que la navegación le pide es saber rehacer una hoja.
 */
vi.mock("@/navigation", () => {
  const hoja = (id: string) => ({ id, label: id, icon: undefined, render: () => null });
  const HOJAS = [hoja("chat/accounts"), hoja("chat/search")];
  return {
    raiz: (id: string) => id.split("#")[0],
    buscarHoja: (id: string) => HOJAS.find((h) => h.id === id),
    aPestaña: (h: { id: string; label: string }, id = h.id) => ({ id, label: h.label, content: null }),
  };
});

const pestaña = (id: string): WorkspaceTab => ({ id, label: id, content: null });

/* `history.back()` avisa con `popstate` en otra vuelta del loop, como en un
   navegador —y un hueco pide otro `back`, que llega en la siguiente—: se le da
   un rato y se deja que React termine lo que eso haya movido. */
const esperar = () => act(() => new Promise<void>((listo) => setTimeout(listo, 30)));
const atras = async () => {
  volver();
  await esperar();
};

const hash = () => location.hash;
const lugar = () => (useNavegacionMovil.getState().enInicio ? "inicio" : useWorkspace.getState().activeId);

beforeEach(() => {
  cleanup();
  history.replaceState(null, "", "/");
  useWorkspace.setState({ tabs: [], activeId: undefined, vistas: {} });
  useNavegacionMovil.setState({ enInicio: true, indice: 0 });
});

describe("atrás en el teléfono", () => {
  it("arranca en Inicio, y Inicio es #/", () => {
    renderHook(useHistorialMovil);
    expect(lugar()).toBe("inicio");
    expect(hash()).toBe("#/");
  });

  it("cada pestaña que se abre es una entrada, y atrás la deshace", async () => {
    renderHook(useHistorialMovil);
    act(() => mostrar(pestaña("chat/accounts")));
    act(() => useWorkspace.getState().openTab(pestaña("perfil/camila")));
    expect(hash()).toBe("#/perfil/camila");

    await atras();
    expect(lugar()).toBe("chat/accounts");
    await atras();
    expect(lugar()).toBe("inicio");
  });

  it("volver desde Inicio a la misma pestaña también es una entrada", async () => {
    renderHook(useHistorialMovil);
    act(() => mostrar(pestaña("chat/accounts")));
    act(irAInicio);
    act(() => mostrar(pestaña("chat/accounts")));
    expect(lugar()).toBe("chat/accounts");
    expect(useNavegacionMovil.getState().indice).toBe(3);

    await atras();
    expect(lugar()).toBe("inicio");
  });

  it("volver a una hoja que se cerró la vuelve a abrir", async () => {
    renderHook(useHistorialMovil);
    act(() => mostrar(pestaña("chat/accounts")));
    act(() => mostrar(pestaña("chat/search")));
    act(() => useWorkspace.getState().closeTab("chat/accounts"));

    await atras();
    expect(lugar()).toBe("chat/accounts");
    expect(useWorkspace.getState().tabs.map((t) => t.id)).toContain("chat/accounts");
  });

  it("una pestaña cerrada que no es hoja es un hueco: atrás la saltea", async () => {
    renderHook(useHistorialMovil);
    act(() => mostrar(pestaña("chat/accounts")));
    act(() => mostrar(pestaña("perfil/camila")));
    act(() => mostrar(pestaña("chat/search")));
    act(() => useWorkspace.getState().closeTab("perfil/camila"));

    await atras();
    expect(lugar()).toBe("chat/accounts");
  });

  it("cerrar la pestaña que se mira reemplaza su entrada en vez de apilar", async () => {
    renderHook(useHistorialMovil);
    act(() => mostrar(pestaña("chat/accounts")));
    act(() => mostrar(pestaña("chat/search")));
    const antes = useNavegacionMovil.getState().indice;
    act(() => useWorkspace.getState().closeTab("chat/search"));

    expect(lugar()).toBe("chat/accounts");
    expect(useNavegacionMovil.getState().indice).toBe(antes);
    await atras();
    expect(lugar()).toBe("chat/accounts");
  });

  it("cerrar desde Inicio la pestaña de adelante deja en Inicio", () => {
    renderHook(useHistorialMovil);
    act(() => mostrar(pestaña("chat/accounts")));
    act(() => mostrar(pestaña("chat/search")));
    act(irAInicio);
    act(() => useWorkspace.getState().closeTab("chat/search"));

    expect(lugar()).toBe("inicio");
    expect(hash()).toBe("#/");
  });

  it("un enlace a una pestaña abre en ella", () => {
    history.replaceState(null, "", "/#/chat/search");
    renderHook(useHistorialMovil);
    expect(lugar()).toBe("chat/search");
    expect(useNavegacionMovil.getState().indice).toBe(0);
  });
});
