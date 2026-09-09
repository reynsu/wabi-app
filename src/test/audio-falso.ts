/**
 * Un `AudioContext` de mentira que cuenta.
 *
 * `cuelume` sintetiza de verdad: por cada señal arma un grafo de osciladores y
 * fuentes de ruido sobre un `AudioContext` compartido. En un test no hay placa
 * de sonido, pero tampoco hace falta — lo que se quiere saber no es cómo suena
 * sino **cuántas veces suena y disparado por qué evento**.
 *
 * Así que se le da un contexto que hace lo mínimo para que el motor no se rompa
 * y que lleva la cuenta de las fuentes creadas. Es exactamente la misma sonda
 * con la que se encontró el bug del doble sonido en el navegador, mudada a un
 * lugar donde puede correr sola.
 *
 * **No se mockea `cuelume`.** Si se reemplazara el paquete por un doble, el test
 * pasaría a probar el doble: no vería que `bind()` engancha en fase de captura,
 * ni que `press` escucha el `pointerdown` y `toggle` el `click`, que es
 * justamente donde estaba el error. Se mockea el hardware, no la librería.
 */

/** Fuentes de sonido creadas desde el último `reiniciarAudio()`. */
let creadas = 0;

export const nodosCreados = () => creadas;
export const reiniciarAudio = () => {
  creadas = 0;
};

/* Un nodo cualquiera. `connect` devuelve su destino porque el motor encadena
   —`oscillator.connect(gain).connect(salida)`— y sin eso la segunda llamada
   sería sobre `undefined`. */
const nodo = (extra: Record<string, unknown> = {}) => ({
  connect: (destino: unknown) => destino,
  disconnect: () => {},
  start: () => {},
  stop: () => {},
  ...extra,
});

/* Un `AudioParam`: un valor con los dos rampas que usa el motor. */
const param = (value = 0) => ({
  value,
  setValueAtTime: () => {},
  exponentialRampToValueAtTime: () => {},
});

class AudioContextFalso {
  state = "running";
  currentTime = 0;
  sampleRate = 44100;
  destination = nodo();

  /* Las dos que se cuentan: toda señal de `cuelume` es una pila de capas de
     tono y de ruido, y cada capa nace en una de estas dos. */
  createOscillator() {
    creadas++;
    return nodo({ frequency: param(440), detune: param(0), type: "sine" });
  }
  createBufferSource() {
    creadas++;
    return nodo({ buffer: null });
  }

  createGain() {
    return nodo({ gain: param(1) });
  }
  createBiquadFilter() {
    return nodo({ frequency: param(1000), Q: param(1), type: "lowpass" });
  }
  createDelay() {
    return nodo({ delayTime: param(0) });
  }
  createDynamicsCompressor() {
    return nodo({
      threshold: param(-24),
      knee: param(30),
      ratio: param(12),
      attack: param(0.003),
      release: param(0.25),
    });
  }
  createBuffer(_canales: number, largo: number) {
    return { getChannelData: () => new Float32Array(largo) };
  }
  resume() {
    return Promise.resolve();
  }
}

/** Deja el entorno listo para que `cuelume` pueda sonar. Se llama una vez. */
export function instalarAudioFalso() {
  Object.assign(globalThis, { AudioContext: AudioContextFalso });

  /* El motor se corta si el navegador todavía no vio un gesto —es la política
     de autoplay, y `cuelume` la respeta—. En un test no hay gestos de verdad,
     así que se declara que ya los hubo; lo que se está probando es el cableado,
     no la política. */
  Object.defineProperty(globalThis.navigator, "userActivation", {
    value: { hasBeenActive: true, isActive: true },
    configurable: true,
  });

  /* El hover de `cuelume` exige puntero fino. Sin `matchMedia` la consulta
     tira, y con una que diga que no, el hover no sonaría nunca y un test de
     hover pasaría en verde por el motivo equivocado. */
  globalThis.matchMedia ??= ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof globalThis.matchMedia;
}
