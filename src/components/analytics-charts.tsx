"use client";

/**
 * Los tres gráficos de las analíticas de una cuenta.
 *
 * Cada uno viene en dos tamaños, porque el board los muestra dos veces:
 *
 * - **`glance`**, la baldosa del riel: una columna de menos de doscientos
 *   píxeles. Ahí no entra un eje, ni una leyenda, ni un tooltip que se pueda
 *   apuntar con el dedo. Lo que entra es la **forma**: dónde está el pico,
 *   hacia dónde va la curva, cuánto pesa cada porción. Es lo que un vistazo
 *   tiene que contestar —"¿hay algo raro acá?"— y nada más.
 * - **`full`**, la pestaña que abre la baldosa: la tarjeta entera del diseño,
 *   con sus ejes, su leyenda y sus tooltips.
 *
 * Los dos leen la misma serie y el mismo `ChartConfig`, así que no pueden
 * dibujar dos cosas distintas: lo único que cambia es cuánto se muestra.
 *
 * Los colores salen del sistema y no de una paleta de gráficos aparte. La rampa
 * `--chart-1..5` de este proyecto es gris a propósito —los gráficos no compiten
 * con el único acento que la app tiene— y donde hace falta significado se usan
 * los mismos verde y rosa de los badges: si "Active" es verde en una tabla, lo
 * positivo no puede ser otro verde tres pantallas más allá.
 *
 * Pero se escriben, no se referencian. Un `fill="var(--chart-1)"` funciona en
 * pantalla y desaparece en la foto: copiar el diálogo lo serializa a un
 * documento aislado —ver `copiar-nodo`— donde esas variables no existen, y un
 * `stroke` que no resuelve no cae en un gris cualquiera, cae en `none`. El
 * gráfico sale con su grilla y sus ejes y sin ninguna de sus líneas. Son los
 * mismos valores que tienen los tokens, escritos donde el SVG los va a pedir.
 */

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Line,
  Pie,
  PieChart,
  XAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useTypeScale } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import {
  comoHora,
  horasDe,
  moderacionDe,
  sentimientoDe,
  type Motivo,
} from "@/pages/analiticas";
import type { Usuario } from "@/pages/usuarios";

/* Los mismos valores que los badges: si "Active" es este verde en la tabla, lo
   positivo no puede ser otro verde acá. Escritos y no como token por lo mismo
   que el violeta de las burbujas: `index.css` es copia byte a byte del showcase
   y una variable de más lo desalinea. */
const VERDE = "#22c55e";
const ROSA = "#f43f5e";

/* El acento del sistema, para la barra de la hora pico. */
const VIOLETA = "#7c4ddb";

/* La rampa de grises de los gráficos: los mismos valores que `--chart-1..5`
   —son los neutros de Tailwind— escritos en hexadecimal. Iguales en claro y en
   oscuro, como los tokens: una rampa que se invierte con el tema haría que dos
   capturas de la misma cuenta no se puedan comparar. */
const GRIS = {
  claro: "#d4d4d4",
  medio: "#737373",
  oscuro: "#525252",
  masOscuro: "#404040",
} as const;

/* ─────────────────────────── Active Hours ─────────────────────────── */

const CONFIG_HORAS = {
  mensajes: { label: "Messages", color: GRIS.medio },
} satisfies ChartConfig;

/* Qué horas se rotulan. Cinco marcas y no veinticuatro: el eje está para ubicar
   el pico en el día, no para leer cada barra, y veinticuatro etiquetas de dos
   palabras en el ancho de una tarjeta se pisan entre sí. */
const MARCAS = [0, 6, 12, 18, 23];

export function ActiveHours({
  usuario,
  compacto,
}: {
  usuario: Usuario;
  compacto?: boolean;
}) {
  const horas = useMemo(() => horasDe(usuario), [usuario]);

  return (
    <ChartContainer
      config={CONFIG_HORAS}
      className={cn("w-full", compacto ? "h-full min-h-0" : "h-64")}
    >
      {/* El aire lateral no es decoración: con margen cero, la marca de las 12
          AM y la de las 11 PM caen medio texto afuera del área y el navegador
          las recorta. */}
      <BarChart
        data={horas}
        margin={{ top: 4, right: 16, bottom: 0, left: 16 }}
      >
        {!compacto && (
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
        )}
        {!compacto && (
          <XAxis
            dataKey="hora"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            ticks={MARCAS}
            tickFormatter={comoHora}
          />
        )}
        {!compacto && (
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent labelFormatter={(h) => comoHora(Number(h))} />
            }
          />
        )}
        {/* `radius` arriba nada más: la barra se apoya en la línea de base, y
            redondearla abajo la despega de ella. */}
        <Bar dataKey="mensajes" radius={[3, 3, 0, 0]}>
          {horas.map((h) => (
            /* La hora pico, en el acento; el resto en el gris de la rampa. Es
                el único dato del gráfico que la ficha de al lado también dice,
                y pintarlo es lo que ata los dos. */
            <Cell
              key={h.hora}
              fill={h.hora === usuario.peakHour ? VIOLETA : GRIS.claro}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/* ─────────────────────────── Sentiment Trend ─────────────────────────── */

const CONFIG_TONO = {
  positivo: { label: "Positive", color: VERDE },
  negativo: { label: "Negative", color: ROSA },
  volumen: { label: "Volume", color: GRIS.medio },
} satisfies ChartConfig;

const FECHA_EJE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

/** La misma guarda que `comoHora`: recharts llama a los formateadores en
 *  cuadros donde todavía no hay dato, y un `Invalid Date` adentro de `Intl` se
 *  lleva puesto el gráfico. */
const comoFecha = (iso: unknown) => {
  const fecha = new Date(String(iso));
  return Number.isNaN(fecha.getTime()) ? "" : FECHA_EJE.format(fecha);
};

export function SentimentTrend({
  usuario,
  compacto,
}: {
  usuario: Usuario;
  compacto?: boolean;
}) {
  const serie = useMemo(() => sentimientoDe(usuario), [usuario]);

  return (
    <ChartContainer
      config={CONFIG_TONO}
      className={cn("w-full", compacto ? "h-full min-h-0" : "h-64")}
    >
      <AreaChart
        data={serie}
        margin={{ top: 4, right: 16, bottom: 0, left: 16 }}
      >
        {/* Las dos áreas se pintan con un degradado que se apaga hacia abajo:
            planas y sólidas, la de arriba tapa a la de abajo y el gráfico deja
            de tener dos series. */}
        <defs>
          {([["positivo", VERDE], ["negativo", ROSA]] as const).map(
            ([clave, color]) => (
              <linearGradient
                key={clave}
                id={`tono-${clave}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            ),
          )}
        </defs>

        {!compacto && <CartesianGrid vertical={false} strokeDasharray="3 3" />}
        {!compacto && (
          <XAxis
            dataKey="cuando"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={40}
            tickFormatter={comoFecha}
          />
        )}
        {!compacto && (
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={comoFecha}
              />
            }
          />
        )}

        <Area
          dataKey="positivo"
          type="natural"
          stroke={VERDE}
          strokeWidth={1.5}
          fill="url(#tono-positivo)"
          stackId="tono"
        />
        <Area
          dataKey="negativo"
          type="natural"
          stroke={ROSA}
          strokeWidth={1.5}
          fill="url(#tono-negativo)"
          stackId="tono"
        />
        {/* El volumen va punteado y sin relleno: no es una tercera categoría
            apilada sobre las otras dos, es contra cuánto hay que leerlas. */}
        <Line
          dataKey="volumen"
          type="natural"
          stroke={GRIS.medio}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
        />

        {!compacto && <ChartLegend content={<ChartLegendContent />} />}
      </AreaChart>
    </ChartContainer>
  );
}

/* ─────────────────────────── Moderated Messages ─────────────────────────── */

/* La rampa gris del sistema, en orden. Cuatro motivos, cuatro escalones: el más
   común se lleva el más oscuro, que es el que se ve primero. No hay colores por
   categoría —"rojo es amenaza"— porque no significan nada por sí solos y le
   gastarían a la dona el único acento que la app tiene. */
const RAMPA = [GRIS.oscuro, GRIS.medio, GRIS.claro, GRIS.masOscuro];

/** El motivo con su color ya elegido. El color se decide una vez y lo leen los
 *  dos que lo necesitan —la porción de la dona y el cuadradito de la leyenda—:
 *  las variables `--color-x` que arma `ChartContainer` sólo existen adentro de
 *  él, y la leyenda vive afuera, así que apoyarse en ellas la dejaba con los
 *  cuadraditos en blanco. */
interface MotivoPintado extends Motivo {
  color: string;
}

const pintar = (motivos: Motivo[]): MotivoPintado[] =>
  motivos.map((m, i) => ({ ...m, color: RAMPA[i % RAMPA.length] }));

const configDeMotivos = (motivos: MotivoPintado[]): ChartConfig =>
  Object.fromEntries(
    motivos.map((m) => [m.id, { label: m.label, color: m.color }]),
  );

export function ModeratedMessages({
  usuario,
  compacto,
}: {
  usuario: Usuario;
  compacto?: boolean;
}) {
  const escala = useTypeScale();
  const motivos = useMemo(() => pintar(moderacionDe(usuario)), [usuario]);
  const config = useMemo(() => configDeMotivos(motivos), [motivos]);
  const total = motivos.reduce((a, m) => a + m.cantidad, 0);

  /* Sin nada frenado no hay dona: un anillo vacío con un cero adentro se lee
     como un gráfico roto, y lo que pasó —que no pasó nada— se dice con
     palabras. */
  if (total === 0) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-1 text-center"
        style={{ fontSize: escala.caption }}
      >
        <span style={{ fontSize: escala.body }}>Nothing moderated</span>
        <span className="text-muted-foreground">
          No message from this account was held.
        </span>
      </div>
    );
  }

  const dona = (
    <ChartContainer
      config={config}
      className={cn(
        "mx-auto w-full",
        compacto ? "h-full min-h-0" : "aspect-square max-h-72",
      )}
    >
      <PieChart>
        {!compacto && (
          <ChartTooltip content={<ChartTooltipContent nameKey="id" hideLabel />} />
        )}
        <Pie
          data={motivos}
          dataKey="cantidad"
          nameKey="id"
          innerRadius="58%"
          outerRadius="88%"
          strokeWidth={2}
        >
          {motivos.map((m) => (
            <Cell key={m.id} fill={m.color} />
          ))}
          {/* El total en el centro del anillo. Es el número que la dona está
              partiendo, y afuera competiría con la leyenda. */}
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !("cx" in viewBox)) return null;
              const { cx = 0, cy = 0 } = viewBox;
              return (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan
                    x={cx}
                    y={cy}
                    className="fill-foreground font-medium"
                    style={{ fontSize: compacto ? 18 : 24 }}
                  >
                    {total.toLocaleString("en-US")}
                  </tspan>
                  {!compacto && (
                    <tspan
                      x={cx}
                      y={Number(cy) + 20}
                      className="fill-muted-foreground"
                      style={{ fontSize: escala.caption }}
                    >
                      messages
                    </tspan>
                  )}
                </text>
              );
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );

  if (compacto) return dona;

  return (
    <div className="flex flex-col gap-4">
      {dona}

      {/* La leyenda, con el conteo y la porción de cada motivo. La de la
          librería sólo pone el nombre, y un nombre solo no dice nada de una
          dona: lo que se vino a saber es cuánto pesa cada uno, y tenerlo que
          sacar apuntando cada porción con el mouse es hacer trabajar a quien
          mira por algo que entra escrito.

          En grilla y no en una fila: cuatro pares de dos renglones puestos en
          fila se cortan en el ancho de una tarjeta. */}
      <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {motivos.map((m) => (
          <li key={m.id} className="flex min-w-0 flex-col gap-1">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: m.color }}
              />
              <span className="min-w-0 truncate" style={{ fontSize: escala.body }}>
                {m.label}
              </span>
            </span>
            <span
              className="tabular-nums text-muted-foreground"
              style={{ fontSize: escala.caption }}
            >
              Count: {m.cantidad} ({Math.round((m.cantidad / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
