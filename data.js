// Play Tennis Dataset
const rawData = [
    { id: 'D1', outlook: 'Sunny', temp: 'Hot', humidity: 'High', wind: 'Weak', play: 'No' },
    { id: 'D2', outlook: 'Sunny', temp: 'Hot', humidity: 'High', wind: 'Strong', play: 'No' },
    { id: 'D3', outlook: 'Overcast', temp: 'Hot', humidity: 'High', wind: 'Weak', play: 'Yes' },
    { id: 'D4', outlook: 'Rain', temp: 'Mild', humidity: 'High', wind: 'Weak', play: 'Yes' },
    { id: 'D5', outlook: 'Rain', temp: 'Cool', humidity: 'Normal', wind: 'Weak', play: 'Yes' },
    { id: 'D6', outlook: 'Rain', temp: 'Cool', humidity: 'Normal', wind: 'Strong', play: 'No' },
    { id: 'D7', outlook: 'Overcast', temp: 'Cool', humidity: 'Normal', wind: 'Strong', play: 'Yes' },
    { id: 'D8', outlook: 'Sunny', temp: 'Mild', humidity: 'High', wind: 'Weak', play: 'No' },
    { id: 'D9', outlook: 'Sunny', temp: 'Cool', humidity: 'Normal', wind: 'Weak', play: 'Yes' },
    { id: 'D10', outlook: 'Rain', temp: 'Mild', humidity: 'Normal', wind: 'Weak', play: 'Yes' },
    { id: 'D11', outlook: 'Sunny', temp: 'Mild', humidity: 'Normal', wind: 'Strong', play: 'Yes' },
    { id: 'D12', outlook: 'Overcast', temp: 'Mild', humidity: 'High', wind: 'Strong', play: 'Yes' },
    { id: 'D13', outlook: 'Overcast', temp: 'Hot', humidity: 'Normal', wind: 'Weak', play: 'Yes' },
    { id: 'D14', outlook: 'Rain', temp: 'Mild', humidity: 'High', wind: 'Strong', play: 'No' }
];

export function getSankeyData() {
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
    
    // Build the flow: Outlook -> Temp -> Humidity -> Wind -> Play
    rawData.forEach(row => {
        const path = [
            { name: row.outlook, category: 'Outlook' },
            { name: row.temp, category: 'Temp' },
            { name: row.humidity, category: 'Humidity' },
            { name: row.wind, category: 'Wind' },
            { name: row.play, category: 'Play' }
        ];
        
        for (let i = 0; i < path.length - 1; i++) {
            const sourceId = getNodeId(path[i].name, path[i].category);
            const targetId = getNodeId(path[i+1].name, path[i+1].category);
            const linkKey = `${sourceId}-${targetId}`;
            
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
    
    return { nodes, links, rawData };
}
