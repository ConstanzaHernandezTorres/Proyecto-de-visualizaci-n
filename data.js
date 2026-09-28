export function getSankeyData(rawData) {
    const nodesMap = new Map();
    const linksMap = new Map();
    
    let nodeIdCounter = 0;
    
    // Helper to get or create node
    function getNodeId(name, category) {
        const key = `${category}:${name}`;
        if (!nodesMap.has(key)) {
            nodesMap.set(key, { id: nodeIdCounter++, name: name, category: category });
        }
        return nodesMap.get(key).id;
    }
    
    // Process the dynamic CSV data
    const filteredData = rawData.filter(row => {
        const outlook = row.Outlook || row.outlook;
        return outlook && outlook.toLowerCase() !== 'none';
    });
    
    filteredData.forEach(row => {
        // Fallbacks in case headers are slightly different
        const path = [
            { name: row.Outlook || row.outlook, category: 'Outlook' },
            { name: row.Temperature || row.temp, category: 'Temp' },
            { name: row.Humidity || row.humidity, category: 'Humidity' },
            { name: row.Wind || row.wind, category: 'Wind' },
            { name: row.Play || row.play, category: 'Play' }
        ];
        
        for (let i = 0; i < path.length - 1; i++) {
            const sourceId = getNodeId(path[i].name, path[i].category);
            const targetId = getNodeId(path[i+1].name, path[i+1].category);
            
            // Link key based on origin Outlook to prevent color mixing
            const originOutlook = row.Outlook || row.outlook;
            const linkKey = `${sourceId}-${targetId}-${originOutlook}`;
            
            if (linksMap.has(linkKey)) {
                const link = linksMap.get(linkKey);
                link.value += 1;
                link.cases.push(row);
            } else {
                linksMap.set(linkKey, {
                    source: sourceId,
                    target: targetId,
                    value: 1,
                    cases: [row]
                });
            }
        }
    });
    
    const nodes = Array.from(nodesMap.values());
    const links = Array.from(linksMap.values());
    
    return { nodes, links, rawData: filteredData };
}
