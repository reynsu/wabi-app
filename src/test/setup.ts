import { instalarAudioFalso } from "./audio-falso";

/* El entorno, una vez para toda la corrida. `bind()` de `cuelume` se engancha
   al `document`, y el `document` de happy-dom vive lo que vive el archivo de
   test, así que esto tiene que estar puesto antes del primer import que lo use. */
instalarAudioFalso();
