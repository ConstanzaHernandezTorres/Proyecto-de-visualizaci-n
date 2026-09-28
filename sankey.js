import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, sankeyCenter } from 'd3-sankey';
import { playGrassBounce, playRacketHit, playNetHit } from './audio.js';

export function renderSankey(data) {
    const container = document.getElementById('chart-container');
    const svgEl = document.getElementById('sankey-svg');
    
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    
    d3.select(svgEl).selectAll('*').remove();

    // El tooltip está dentro de #chart-container (position: absolute), así que su
    // posición se calcula relativa al contenedor y no a la página (pageX/pageY).
    const tooltipEl = document.getElementById('tooltip');
    function moveTooltip(event) {
        const [x, y] = d3.pointer(event, container);
        const w = tooltipEl.offsetWidth, h = tooltipEl.offsetHeight;
        const left = Math.max(8, Math.min(x + 15, container.clientWidth - w - 8));
        let top = y + 15;
        if (top + h > container.clientHeight - 8) top = y - h - 15;  // si no cabe abajo, va arriba
        tooltipEl.style.left = left + 'px';
        tooltipEl.style.top = Math.max(8, top) + 'px';
    }
    
    const svg = d3.select(svgEl)
        .attr("viewBox", [0, 0, width, height]);
        
    const sankeyGen = sankey()
        .nodeId(d => d.id)
        .nodeAlign(sankeyCenter)
        .nodeWidth(20)
        .nodePadding(30)
        .extent([[40, 40], [width - 40, height - 40]]);
        
    const { nodes, links } = sankeyGen({
        nodes: data.nodes.map(d => Object.assign({}, d)),
        links: data.links.map(d => Object.assign({}, d))
    });
    
    // Draw court lines behind the graph
    svg.append("line")
       .attr("x1", width/2).attr("y1", 0)
       .attr("x2", width/2).attr("y2", height)
       .attr("stroke", "rgba(255,255,255,0.4)")
       .attr("stroke-width", 4)
       .attr("stroke-dasharray", "10,10");
       
    // Column Labels
    const categoriesLabels = [
        { id: 'Outlook', label: 'Clima' },
        { id: 'Temp', label: 'Temperatura' },
        { id: 'Humidity', label: 'Humedad' },
        { id: 'Wind', label: 'Viento' },
        { id: 'Play', label: 'Decisión' }
    ];
    
    const catPositions = categoriesLabels.map(c => {
        const firstNode = nodes.find(n => n.category === c.id);
        return { label: c.label, x: firstNode ? firstNode.x0 + (firstNode.x1 - firstNode.x0)/2 : 0 };
    }).filter(d => d.x > 0);
    
    svg.append("g")
        .selectAll("text")
        .data(catPositions)
        .join("text")
        .attr("x", d => d.x)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .attr("fill", "rgba(255,255,255,0.7)")
        .attr("font-size", "14px")
        .attr("font-weight", "600")
        .attr("text-transform", "uppercase")
        .attr("letter-spacing", "2px")
        .text(d => d.label);

    // Color scale for links based on Outlook origin
    const colorScale = d3.scaleOrdinal()
        .domain(['Sunny', 'Overcast', 'Rain'])
        .range(['#f97316', '#38bdf8', '#a855f7']); // Vibrant Orange, Cyan, Purple

    // Draw Links
    svg.append("g")
        .attr("class", "links")
        .selectAll("path")
        .data(links)
        .join("path")
        .attr("class", "link")
        .attr("d", sankeyLinkHorizontal())
        .attr("stroke", d => colorScale(d.cases[0].outlook))
        .attr("stroke-width", d => Math.max(1, d.width))
        .on("mouseenter", function(event, d) {
            d3.selectAll('.link').style("stroke-opacity", 0.05);
            d3.select(this).style("stroke-opacity", 0.6);
            
            // Show tooltip
            const tooltip = d3.select('#tooltip');
            tooltip.style('opacity', 1)
                   .html(`${d.source.name} → ${d.target.name}<br/>${d.value} días`);
            moveTooltip(event);
                   
            // Update narrative panel
            const panel = document.getElementById('narrative-panel');
            const sample = d.cases[0];
            const decision = sample.play === 'Yes' ? 'JUGAR' : 'NO JUGAR';
            
            let text = `💡 Día ${sample.outlook.toUpperCase()}, con temperatura ${sample.temp.toUpperCase()}, humedad ${sample.humidity.toUpperCase()} y viento ${sample.wind.toUpperCase()}. Decisión: ${decision}.`;
            panel.innerText = text;
                   
            // Trigger animation for cases in this link
            animateCases(d.cases);
        })
        .on("mousemove", moveTooltip)
        .on("mouseleave", function() {
            d3.selectAll('.link').style("stroke-opacity", null);
            d3.select('#tooltip').style('opacity', 0);
            document.getElementById('narrative-panel').innerText = "Pasa el cursor sobre el gráfico para ver la regla lógica...";
        });

    // Draw Nodes (Icons instead of abstract names where possible)
    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    node.append("rect")
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0);
        
    // Add text labels
    node.append("text")
        .attr("x", d => d.x0 < width / 2 ? 6 + (d.x1 - d.x0) : -6)
        .attr("y", d => (d.y1 - d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
        .text(d => {
            let prefix = '';
            if (d.name === 'Sunny') prefix = '☀️ ';
            if (d.name === 'Overcast') prefix = '☁️ ';
            if (d.name === 'Rain') prefix = '🌧️ ';
            if (d.name === 'Yes') prefix = '🎾 ';
            if (d.name === 'No') prefix = '❌ ';
            return prefix + d.name;
        });
        
    // Map of nodes for quick access during animation
    const nodeMap = new Map(nodes.map(n => [`${n.category}:${n.name}`, n]));
    
    let isAnimating = false;
    
    function animateCases(casesToAnimate) {
        if (isAnimating) return;
        isAnimating = true;
        
        // Create SVG tennis balls
        const balls = svg.append("g").attr("class", "balls-container")
            .selectAll("g.tennis-ball")
            .data(casesToAnimate)
            .join("g")
            .attr("class", "tennis-ball");
            
        balls.append("circle")
            .attr("r", 10)
            .attr("fill", "#dfff00");
            
        // White seams of the tennis ball
        balls.append("path")
            .attr("d", "M -5,-7 Q 3,0 -5,7 M 5,-7 Q -3,0 5,7")
            .attr("fill", "none")
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 2);
            
        // Initial positions (Outlook nodes)
        balls.attr("transform", d => {
            const n = nodeMap.get(`Outlook:${d.outlook}`);
            const x = n.x0 + (n.x1 - n.x0)/2;
            const y = n.y0 + Math.random() * (n.y1 - n.y0);
            d.currentAngle = 0;
            return `translate(${x},${y}) rotate(0)`;
        });
        
        const categories = ['Outlook', 'Temp', 'Humidity', 'Wind', 'Play'];
        
        // Sequence of transitions
        async function runSequence() {
            for (let i = 0; i < categories.length - 1; i++) {
                const currentCat = categories[i];
                const nextCat = categories[i+1];
                
                await balls.transition()
                    .duration(700)
                    .ease(d3.easeCubicInOut)
                    .attrTween("transform", function(d) {
                        const currentTransform = d3.select(this).attr("transform") || "";
                        const match = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                        const startX = match ? parseFloat(match[1]) : 0;
                        const startY = match ? parseFloat(match[2]) : 0;
                        
                        const nextVal = d[nextCat.toLowerCase()];
                        const n = nodeMap.get(`${nextCat}:${nextVal}`);
                        const endX = n.x0 + (n.x1 - n.x0)/2;
                        const endY = n.y0 + (n.y1 - n.y0) / 2 + (Math.random() * 20 - 10);
                        
                        const dx = endX - startX;
                        const dy = endY - startY;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        const rotationDelta = (dist / (Math.PI * 20)) * 360;
                        
                        const startAngle = d.currentAngle || 0;
                        const endAngle = startAngle + (dx > 0 ? rotationDelta : -rotationDelta);
                        d.currentAngle = endAngle;
                        
                        const interpX = d3.interpolateNumber(startX, endX);
                        const interpY = d3.interpolateNumber(startY, endY);
                        const interpAngle = d3.interpolateNumber(startAngle, endAngle);
                        
                        return function(t) {
                            return `translate(${interpX(t)}, ${interpY(t)}) rotate(${interpAngle(t)})`;
                        };
                    })
                    .end()
                    .then(() => {
                        // Play bounce on every intermediate node
                        if (i < categories.length - 2) {
                            playGrassBounce();
                        }
                    })
                    .catch(() => {}); // handle interrupted transitions
            }
            
            // Final Hit
            const hasNo = casesToAnimate.some(c => c.play === 'No');
            const hasYes = casesToAnimate.some(c => c.play === 'Yes');
            
            if (hasYes) playRacketHit();
            if (hasNo) setTimeout(playNetHit, 150);
            
            // Remove balls after a delay
            setTimeout(() => {
                svg.select(".balls-container").remove();
                isAnimating = false;
            }, 500);
        }
        
        runSequence();
    }
}