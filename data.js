import { csv } from 'd3';
import csvUrl from './play_tennis_dataset.csv?url';

// Play Tennis Dataset (datos reales, procesados en el navegador)
// Fuente: play_tennis_dataset.csv (Kaggle, milapgohil), 6666 filas.
// Los valores faltantes vienen escritos como la palabra "None". Se descartan las
// filas que tengan algún valor fuera de los permitidos (5425 quedan completas).

// Columnas del gráfico, en orden. `csvName` es el encabezado del CSV y `field` la
// propiedad que usa el resto del código. `values` mapea valor del CSV -> valor
// interno ('Rainy' del CSV se llama 'Rain' en sankey.js). El orden de `values`
// define el orden de los nodos; cualquier otro valor cuenta como faltante.
const COLUMNS = [
    { category: 'Outlook', csvName: 'Outlook', field: 'outlook', values: { Sunny: 'Sunny', Overcast: 'Overcast', Rainy: 'Rain' } },
    { category: 'Temp', csvName: 'Temperature', field: 'temp', values: { Hot: 'Hot', Mild: 'Mild', Cool: 'Cool' } },
    { category: 'Humidity', csvName: 'Humidity', field: 'humidity', values: { High: 'High', Normal: 'Normal' } },
    { category: 'Wind', csvName: 'Wind', field: 'wind', values: { Weak: 'Weak', Strong: 'Strong' } },
    { category: 'Play', csvName: 'Play', field: 'play', values: { No: 'No', Yes: 'Yes' } }
];

// Máximo de casos de ejemplo por enlace. `value` conserva el conteo real; `cases`
// es solo una muestra proporcional (una bola por caso en la animación), para que
// la animación no dibuje miles de bolas.
const MAX_CASES_PER_LINK = 30;

// Carga el CSV y lo transforma en { nodes, links, rawData }
export async function getSankeyData() {
    const rows = await csv(csvUrl);
    return buildSankeyData(rows);
}

export function buildSankeyData(rows) {
    // 1) Limpieza: solo filas con los cinco valores válidos
    const rawData = [];
    for (const row of rows) {
        const clean = { id: row.Day };
        let complete = true;
        for (const col of COLUMNS) {
            const value = col.values[(row[col.csvName] || '').trim()];
            if (value === undefined) { complete = false; break; }
            clean[col.field] = value;
        }
        if (complete) rawData.push(clean);
    }
    console.info(`Datos: ${rows.length} filas leídas, ${rows.length - rawData.length} descartadas por valores faltantes, ${rawData.length} usadas.`);

    // 2) Nodos en orden fijo
    const nodesMap = new Map();
    let nodeIdCounter = 0;
    COLUMNS.forEach(col => Object.values(col.values).forEach(name => {
        nodesMap.set(`${col.category}:${name}`, { id: nodeIdCounter++, name, category: col.category });
    }));
    const nodeId = (category, name) => nodesMap.get(`${category}:${name}`).id;

    // 3) Combinaciones distintas y cuántos días tiene cada una
    const groupsMap = new Map();
    for (const row of rawData) {
        const key = COLUMNS.map(col => row[col.field]).join('|');
        if (!groupsMap.has(key)) groupsMap.set(key, { ...row, count: 0 });
        groupsMap.get(key).count++;
    }

    // 4) Enlaces entre columnas contiguas, sumando los días de cada combinación
    const linksMap = new Map();
    for (const g of groupsMap.values()) {
        for (let i = 0; i < COLUMNS.length - 1; i++) {
            const a = COLUMNS[i], b = COLUMNS[i + 1];
            const source = nodeId(a.category, g[a.field]);
            const target = nodeId(b.category, g[b.field]);
            const key = `${source}-${target}`;
            if (!linksMap.has(key)) linksMap.set(key, { source, target, value: 0, groups: [] });
            const link = linksMap.get(key);
            link.value += g.count;
            link.groups.push(g);
        }
    }

    const links = Array.from(linksMap.values()).map(link => {
        // Combinaciones de mayor a menor: cases[0] es la más frecuente del enlace
        const sorted = link.groups.slice().sort((x, y) => y.count - x.count);
        const cases = [];
        sorted.forEach(g => {
            const k = Math.max(1, Math.round(g.count * MAX_CASES_PER_LINK / link.value));
            for (let j = 0; j < k; j++) cases.push({ ...g }); // copia: sankey.js guarda estado de la animación en cada caso
        });
        return { source: link.source, target: link.target, value: link.value, cases };
    });

    return { nodes: Array.from(nodesMap.values()), links, rawData };
}