import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, sankeyCenter } from 'd3-sankey';
import { playGrassBounce, playRacketHit, playNetHit } from './audio.js';

export function renderSankey(data) {
    const container = document.getElementById('chart-container');
    const svgEl = document.getElementById('sankey-svg');
    
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    
    d3.select(svgEl).selectAll('*').remove();
    
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
        .attr("fill", "#dfff00")
        .attr("font-size", "13px")
        .attr("font-weight", "700")
        .attr("text-transform", "uppercase")
        .attr("letter-spacing", "2px")
        .text(d => d.label);

    // Draw Links
    svg.append("g")
        .attr("class", "links")
        .selectAll("path")
        .data(links)
        .join("path")
        .attr("class", "link")
        .attr("d", sankeyLinkHorizontal())
        .attr("stroke-width", d => Math.max(1, d.width))
        .on("mouseenter", function(event, d) {
            d3.selectAll('.link').style("stroke-opacity", 0.05);
            d3.select(this).style("stroke-opacity", 0.6);
            
            // Show tooltip
            const tooltip = d3.select('#tooltip');
            tooltip.style('opacity', 1)
                   .html(`${d.source.name} → ${d.target.name}<br/>${d.value} días`)
                   .style('left', (event.pageX + 15) + 'px')
                   .style('top', (event.pageY - 15) + 'px');
                   
            // Trigger animation for cases in this link
            animateCases(d.cases);
        })
        .on("mouseleave", function() {
            d3.selectAll('.link').style("stroke-opacity", null);
            d3.select('#tooltip').style('opacity', 0);
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
        
        // Create balls
        const balls = svg.append("g").attr("class", "balls-container")
            .selectAll("text")
            .data(casesToAnimate)
            .join("text")
            .attr("class", "tennis-ball")
            .text("🎾")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central");
            
        // Initial positions (Outlook nodes)
        balls.attr("x", d => {
            const n = nodeMap.get(`Outlook:${d.outlook}`);
            return n.x0 + (n.x1 - n.x0)/2;
        }).attr("y", d => {
            const n = nodeMap.get(`Outlook:${d.outlook}`);
            // random spread vertically
            return n.y0 + Math.random() * (n.y1 - n.y0);
        });
        
        const categories = ['Outlook', 'Temp', 'Humidity', 'Wind', 'Play'];
        
        // Sequence of transitions
        async function runSequence() {
            for (let i = 0; i < categories.length - 1; i++) {
                const currentCat = categories[i];
                const nextCat = categories[i+1];
                
                await balls.transition()
                    .duration(600)
                    .ease(d3.easeCubicInOut)
                    .attr("x", d => {
                        const nextVal = d[nextCat.toLowerCase()];
                        const n = nodeMap.get(`${nextCat}:${nextVal}`);
                        return n.x0 + (n.x1 - n.x0)/2;
                    })
                    .attr("y", d => {
                        const nextVal = d[nextCat.toLowerCase()];
                        const n = nodeMap.get(`${nextCat}:${nextVal}`);
                        // Map the case to the node's vertical span
                        return n.y0 + (n.y1 - n.y0) / 2 + (Math.random() * 20 - 10);
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
            playRacketHit(); // For Yes
            // We can check if any are 'No' to play net hit
            const hasNo = casesToAnimate.some(c => c.play === 'No');
            const hasYes = casesToAnimate.some(c => c.play === 'Yes');
            
            if (hasYes) playRacketHit();
            if (hasNo) setTimeout(playNetHit, 150); // slight offset if both
            
            // Remove balls after a delay
            setTimeout(() => {
                svg.select(".balls-container").remove();
                isAnimating = false;
            }, 500);
        }
        
        runSequence();
    }
}
